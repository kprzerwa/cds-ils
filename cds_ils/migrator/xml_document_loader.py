# -*- coding: utf-8 -*-
#
# This file is part of Invenio.
# Copyright (C) 2018-2020 CERN.
#
# cds-migrator-kit is free software; you can redistribute it and/or modify it
# under the terms of the MIT License; see LICENSE file for more details.

"""CDS Migrator Records loader."""

import logging
import uuid

import click
from flask import current_app
from invenio_app_ils.documents.api import DocumentIdProvider
from invenio_app_ils.errors import IlsValidationError
from invenio_app_ils.proxies import current_app_ils
from invenio_db import db
from invenio_pidstore.errors import PIDAlreadyExists
from sqlalchemy.exc import IntegrityError

from cds_ils.literature.api import get_record_by_legacy_recid
from cds_ils.migrator.utils import add_cover_metadata, clean_created_by_field
from cds_ils.minters import legacy_recid_minter

cli_logger = logging.getLogger("migrator")


class CDSDocumentDumpLoader(object):
    """Migrate a CDS record.

    create and create_record has been changed to change the hardcoded
    pid_type recid to docid.
    """

    @classmethod
    def create_files(cls, record, files, existing_files):
        """Dump files information instead of the file."""
        record["_migration"]["files"] = []
        for key, meta in files.items():
            obj = cls.create_file(None, key, meta)
            # remove not needed, ES cannot handle list of lists
            del obj["recids_doctype"]
            record["_migration"]["files"].append(obj)
        if record["_migration"]["files"]:
            record["_migration"]["has_files"] = True

    @classmethod
    def create_file(cls, bucket, key, file_versions):
        """Return dict describing the latest file version."""
        return file_versions[-1]

    @classmethod
    def create(cls, dump):
        """Create record based on dump."""
        dump.prepare_revisions()
        dump.prepare_files()
        # if we have a final revision - to remove when data cleaned.
        try:
            if dump.revisions[-1]:
                record = cls.create_record(dump)

                if dump.files:
                    cls.create_files(record, dump.files, existing_files=None)
                    record.commit()
                    db.session.commit()

                return record
        except IndexError as e:
            click.secho("Revision problem", fg="red")
            raise e

    @classmethod
    def create_record(cls, dump):
        """Create a new record from dump."""
        document_cls = current_app_ils.document_record_cls
        record_uuid = uuid.uuid4()

        timestamp, json_data = dump.revisions[-1]
        json_data = clean_created_by_field(json_data)
        add_cover_metadata(json_data)

        try:
            with db.session.begin_nested():
                # checks if the document with this legacy_recid already exists
                legacy_recid_minter(json_data["legacy_recid"], record_uuid)

                provider = DocumentIdProvider.create(
                    object_type="rec",
                    object_uuid=record_uuid,
                )
                json_data["pid"] = provider.pid.pid_value
                document = document_cls.create(json_data, record_uuid)
                document.model.created = dump.created.replace(tzinfo=None)
                document.model.updated = timestamp.replace(tzinfo=None)
                document.commit()
            db.session.commit()
            return document
        except IlsValidationError as e:
            click.secho("Field: {}".format(e.errors[0].res["field"]), fg="red")
            click.secho(e.original_exception.message, fg="red")
            raise e
        except PIDAlreadyExists as e:
            allow_updates = \
                current_app.config.get("CDS_ILS_MIGRATION_ALLOW_UPDATES")
            if not allow_updates:
                raise e
            # update document if already exists with legacy_recid
            document = get_record_by_legacy_recid(document_cls,
                                                  json_data["legacy_recid"])
            document.update(json_data)
            document.model.updated = timestamp.replace(tzinfo=None)
            document.commit()
            db.session.commit()
            return document

import React from 'react';
import { Importer } from '../backoffice/Importer';
import { ImporterTaskDetails } from '../backoffice/Importer/ImporterTaskDetails';
import { CdsBackOfficeRoutes } from './BackofficeUrls';
import { Switch, Route } from 'react-router-dom';
import { NotFound } from '@inveniosoftware/react-invenio-app-ils';

export const ImporterRoute = () => {
  return (
    <Switch>
      <Route
        exact
        path={CdsBackOfficeRoutes.importerCreate}
        component={Importer}
      />
      <Route
        exact
        path={CdsBackOfficeRoutes.importerDetails}
        component={ImporterTaskDetails}
      />
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
};

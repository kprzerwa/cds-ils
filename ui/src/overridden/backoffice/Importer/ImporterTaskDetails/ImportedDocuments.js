import React from 'react';
import PropTypes from 'prop-types';
import {
  Accordion,
  Button,
  Divider,
  Header,
  Icon,
  Message,
} from 'semantic-ui-react';
import _isEmpty from 'lodash/isEmpty';
import _get from 'lodash/get';
import { CdsBackOfficeRoutes } from '../../../routes/BackofficeUrls';
import { ReportDetails } from './ReportDetails';
import { Link } from 'react-router-dom';
import { BackOfficeRoutes } from '@inveniosoftware/react-invenio-app-ils';
import { DocumentIcon } from '@inveniosoftware/react-invenio-app-ils';
import { importerApi } from '../../../api/importer';
import { invenioConfig } from '@inveniosoftware/react-invenio-app-ils';

export class ImportedDocuments extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeIndex: -1,
      importCompleted: false,
      data: null,
      isLoading: true,
    };
  }

  componentDidMount() {
    const { taskId } = this.props;
    this.intervalId = setInterval(
      () => this.checkForData(taskId),
      invenioConfig.IMPORTER.fetchTaskStatusIntervalSecs
    );
    this.checkForData(taskId);
  }

  componentWillUnmount = () => {
    this.intervalId && clearInterval(this.intervalId);
  };

  checkForData = async () => {
    const { importCompleted, data } = this.state;
    const { taskId } = this.props;

    if (!importCompleted) {
      const nextEntry = _get(data, 'loaded_entries', 0);
      const knownEntries = _get(data, 'reports', []);
      const response = await importerApi.check(taskId, nextEntry);
      const responseData = response.data;
      if (responseData) {
        responseData.reports = knownEntries.concat(
          _get(responseData, 'reports', [])
        );
      }
      if (response.data.state !== 'RUNNING') {
        this.setState({
          importCompleted: true,
          isLoading: false,
          data: response.data,
        });
      } else {
        this.setState({
          data: response.data,
          isLoading: true,
        });
      }
    } else {
      this.intervalId && clearInterval(this.intervalId);
    }
  };

  handleClick = (e, titleProps) => {
    const { index } = titleProps;
    const { activeIndex } = this.state;
    const newIndex = activeIndex === index ? -1 : index;

    this.setState({ activeIndex: newIndex });
  };

  renderErrorMessage = data => {
    return (
      <Message negative>
        <Message.Header>Failed to import</Message.Header>
        <p>
          The import of the literatures failed, please try again. <br />
          If this error persists contact our technical support.
        </p>
      </Message>
    );
  };

  renderResultsHeader = () => {
    const { data, isLoading } = this.state;
    return (
      <>
        <Button
          className="default-margin-top"
          labelPosition="left"
          icon="left arrow"
          content="Import other files"
          loading={!data}
          disabled={!data}
          as={Link}
          to={CdsBackOfficeRoutes.importerCreate}
        />
        <Divider hidden />
        {!data ? (
          <>
            <Icon loading name="circle notch" />
            Fetching status...
          </>
        ) : isLoading ? (
          <>
            <Icon name="circle notch" loading aria-label="Import in progress" />
            Importing literatures... This may take a while. You may leave the
            page, the process will continue in background.
          </>
        ) : data.state === 'SUCCEEDED' ? (
          <>
            <Icon name="check circle" color="green" aria-label="Completed" />
            Literatures imported successfully.
          </>
        ) : (
          <>
            <Icon name="times circle" color="red" aria-label="Failed" />
            Literatures import failed.
          </>
        )}
      </>
    );
  };

  renderResultsContent = () => {
    const { data, activeIndex } = this.state;
    return (
      <Accordion className="importer" styled fluid>
        {data.reports.map((elem, index) => {
          const report = _get(elem, 'report', null);
          const importSuccess = _get(elem, 'success', null);
          const document = importSuccess
            ? report.created_document
              ? report.created_document
              : report.updated_document
            : null;
          return (
            <div key={elem.index}>
              <Accordion.Title
                active={activeIndex === index}
                index={index}
                onClick={this.handleClick}
              >
                <Icon name="dropdown" />
                {!_isEmpty(document) ? (
                  <Link
                    to={BackOfficeRoutes.documentDetailsFor(document.pid)}
                    target="_blank"
                  >
                    <DocumentIcon />
                    {document.title}
                  </Link>
                ) : importSuccess ? (
                  'No document created or updated'
                ) : (
                  <span className="danger">Error on importing this record</span>
                )}
              </Accordion.Title>
              <Accordion.Content active={activeIndex === index}>
                <ReportDetails item={elem} />
              </Accordion.Content>
            </div>
          );
        })}
      </Accordion>
    );
  };

  render() {
    const { data } = this.state;
    return (
      <>
        {this.renderResultsHeader()}
        {!_isEmpty(data) && data.state !== 'FAILED' ? (
          <>
            <Header as="h2">Literatures</Header>
            {!_isEmpty(data) ? (
              (data.loaded_entries || data.loaded_entries === 0) &&
              data.total_entries ? (
                <p>
                  {'Processed ' +
                    data.loaded_entries +
                    ' literatures out of ' +
                    data.total_entries +
                    '.'}
                </p>
              ) : (
                <p>Processing file...</p>
              )
            ) : null}
            {!_isEmpty(data.reports) ? this.renderResultsContent() : null}
          </>
        ) : !_isEmpty(data) && data.state === 'FAILED' ? (
          this.renderErrorMessage(data)
        ) : null}
      </>
    );
  }
}

ImportedDocuments.propTypes = {
  taskId: PropTypes.string.isRequired,
};

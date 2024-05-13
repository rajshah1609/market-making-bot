import React, { Component } from "react";
import { connect } from "react-redux";
import * as actions from "../actions/index";

import VolumeBotCard from "../components/VolumeBotCard";
import { AddNoti } from "../helpers/Notification";

import { Col, Row, Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCogs } from "@fortawesome/free-solid-svg-icons";

import DataTable from "../components/DataTable";
import { FormatTime, PairDecimalsAmount } from "../helpers/constant";

const columns = [
  {
    dataField: "exchangeName",
    text: "Exchange Name",
  },
  {
    dataField: "pair",
    text: "Pair",
  },
  {
    dataField: "minVolume",
    text: "Min Volume",
  },
  {
    dataField: "maxVolume",
    text: "Max Volume",
  },
  {
    dataField: "minSeconds",
    text: "Min Seconds",
  },
  {
    dataField: "maxSeconds",
    text: "Max Seconds",
  },
  {
    dataField: "minuteDifference",
    text: "Min. Diff.",
  },
  {
    dataField: "volumeDoneUSDT",
    text: "24hrs vol. (USD)",
  },
  {
    dataField: "totalLoss",
    text: "24hrs loss (USD)",
  },
  {
    dataField: "status",
    text: "Status",
  },
  {
    dataField: "message",
    text: "Message",
  },
  {
    dataField: "actionBtn",
    text: "Actions",
  },
];

const prepopulatedData = [
  {
    id: 1,
    maxVolume: (
      <div className="table-one__loader">
        <FontAwesomeIcon icon={faCogs} size="5x" />
        <div>LOADING</div>
      </div>
    ),
  },
];

const EmptyData = [
  {
    id: 1,
    maxVolume: (
      <div className="table-one__loader">
        <div>No Data</div>
      </div>
    ),
  },
];

class VolumeBot extends Component {
  componentDidMount() {
    this.props.volumeBotStatus();
  }

  renderData(allData) {
    // console.log(":volumebot :render", allData);
    if (!allData) return null;
    let returnData = [];
    for (let i = 0; i < allData.length; i++) {
      let data = allData[i];
      let obj = {
        id: i + "",
        exchangeName: data.exchange.toUpperCase(),
        pair: data.details.pair,
        minVolume: parseFloat(data.details.minVolume).toFixed(
          PairDecimalsAmount[data.details.pair]
        ),
        maxVolume: parseFloat(data.details.maxVolume).toFixed(
          PairDecimalsAmount[data.details.pair]
        ),
        minSeconds: data.details.minSeconds,
        maxSeconds: data.details.maxSeconds,
        status:
          data.details.status == "start" ? (
            <span className="green">{data.details.status}</span>
          ) : (
            <span className="red">{data.details.status}</span>
          ),
        message: data.details.message,
        minuteDifference: data.details.minuteDifference,
        volumeDoneUSDT: data.details.volumeDoneUSDT,
        totalLoss: data.details.totalLoss,
        actionBtn: (
          <>
            <Button
              className="action-btn"
              onClick={() => {
                this.setState({
                  modalForm: (
                    <VolumeBotCard
                      volumeBotUpdate={this.props.volumeBotUpdate}
                      loading={false}
                      exchange={data.exchange}
                      pair={data.details.pair}
                      minVolume={parseFloat(data.details.minVolume).toFixed(
                        PairDecimalsAmount[data.details.pair]
                      )}
                      maxVolume={parseFloat(data.details.maxVolume).toFixed(
                        PairDecimalsAmount[data.details.pair]
                      )}
                      minSeconds={data.details.minSeconds}
                      maxSeconds={data.details.maxSeconds}
                    />
                  ),
                  modalTitle: "Volume Bot",
                  showModal: true,
                });
              }}
            >
              Update
            </Button>
            <Button
              className="action-btn"
              onClick={() => {
                this.props.forceStart({
                  exchange: data.exchange,
                  pair: data.details.pair,
                });
              }}
            >
              Force Start
            </Button>
          </>
        ),
      };
      returnData.push(obj);
    }
    return returnData;
  }

  componentDidUpdate() {
    // console.log(":volumebot :cupdate", this.props.volumeBot.status);
    const volumeBotForm = this.props.volumeBot.form;
    const volumeBotStatus = this.props.volumeBot.status;

    if (volumeBotForm.error) {
      return AddNoti(volumeBotForm.error, {
        type: "error",
        duration: 2000,
        position: "bottom-right",
      });
    }

    if (volumeBotForm.success) {
      return AddNoti(volumeBotForm.success, {
        type: "success",
        duration: 2000,
        position: "bottom-right",
      });
    }

    if (this.props.volumeBot.forceStart.error) {
      return AddNoti(this.props.volumeBot.forceStart.error, {
        type: "error",
        duration: 2000,
        position: "bottom-right",
      });
    }

    if (this.props.volumeBot.forceStart.success) {
      return AddNoti(this.props.volumeBot.forceStart.success, {
        type: "success",
        duration: 2000,
        position: "bottom-right",
      });
    }

    if (volumeBotStatus.success) {
      return AddNoti(volumeBotStatus.success, {
        type: "info",
        duration: 2000,
        position: "bottom-right",
      });
    }

    if (volumeBotStatus.error) {
      return AddNoti(volumeBotStatus.error, {
        type: "error",
        duration: 2000,
        position: "bottom-right",
      });
    }
  }

  render() {
    const isLoading = this.props.volumeBot.form.loading === true;

    // console.log(":volumebot ", this.props.volumeBot.status.data);

    return (
      <div className="main-panel">
        <Row>
          <Col lg={12} md={12} sm={12} xs={12}>
            <DataTable
              data={this.props.volumeBot.status.data}
              renderData={this.renderData}
              volumeBotUpdate={this.props.volumeBotUpdate}
              columns={columns}
              prepopulatedData={prepopulatedData}
              emptyData={EmptyData}
              forceStart={this.props.volumebotForceStart}
            />
          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps({ auth, volumeBot }) {
  return { auth, volumeBot };
}

function mapDispatchToProps(dispatch) {
  return {
    volumeBotUpdate: (data) => dispatch(actions.volumeBotUpdate(data)),
    volumeBotStatus: () => {
      dispatch(actions.volumeBotGet());
    },
    volumebotForceStart: (data) => {
      dispatch(actions.VolumebotForceStart(data));
    },
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(VolumeBot);

import React, { useState } from "react";
import { Form, Col, Button, InputGroup, FormControl } from "react-bootstrap";
const VolumeBotCard = (props) => {
  const [minVolume, setminVolume] = useState(props.minVolume);
  const [maxVolume, setmaxVolume] = useState(props.maxVolume);
  const [minSeconds, setminSeconds] = useState(props.minSeconds);
  const [maxSeconds, setmaxSeconds] = useState(props.maxSeconds);

  return (
    <Col xs="12" sm="12" md="12" lg="12" xl="12">
      <div className="center-form mt-5">
        <Form className="p-3">
          <Form.Group controlId={props.exchange}>
            <InputGroup className="mb-3">
              <FormControl type="text" value={props.exchange} disabled />
              <InputGroup.Append>
                <InputGroup.Text style={{ fontSize: "15px" }}>
                  Exchange
                </InputGroup.Text>
              </InputGroup.Append>
            </InputGroup>
            <InputGroup className="mb-3">
              <FormControl type="text" value={props.pair} disabled />
              <InputGroup.Append>
                <InputGroup.Text style={{ fontSize: "15px" }}>
                  Pair
                </InputGroup.Text>
              </InputGroup.Append>
            </InputGroup>
            <InputGroup className="mb-3">
              <FormControl
                type="text"
                placeholder="Minimum Volume"
                value={minVolume}
                onChange={({ target: { value } }) => setminVolume(value)}
              />
              <InputGroup.Append>
                <InputGroup.Text style={{ fontSize: "15px" }}>
                  Min Amount
                </InputGroup.Text>
              </InputGroup.Append>
            </InputGroup>
            <InputGroup className="mb-3">
              <FormControl
                type="text"
                placeholder="Maximum Volume"
                value={maxVolume}
                onChange={({ target: { value } }) => setmaxVolume(value)}
              />
              <InputGroup.Append>
                <InputGroup.Text style={{ fontSize: "15px" }}>
                  Max Amount
                </InputGroup.Text>
              </InputGroup.Append>
            </InputGroup>
            <InputGroup className="mb-3">
              <FormControl
                type="text"
                placeholder="Minimum Seconds"
                value={minSeconds}
                onChange={({ target: { value } }) => setminSeconds(value)}
              />
              <InputGroup.Append>
                <InputGroup.Text style={{ fontSize: "15px" }}>
                  Min Seconds
                </InputGroup.Text>
              </InputGroup.Append>
            </InputGroup>
            <InputGroup className="mb-3">
              <FormControl
                type="text"
                placeholder="Maximum Seconds"
                value={maxSeconds}
                onChange={({ target: { value } }) => setmaxSeconds(value)}
              />
              <InputGroup.Append>
                <InputGroup.Text style={{ fontSize: "15px" }}>
                  Max Seconds
                </InputGroup.Text>
              </InputGroup.Append>
            </InputGroup>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Button
                variant="dark"
                onClick={() =>
                  props.volumeBotUpdate({
                    minSeconds: minSeconds,
                    maxSeconds: maxSeconds,
                    minVolume: minVolume,
                    maxVolume: maxVolume,
                    exchange: props.exchange,
                    pair: props.pair,
                    status: "start",
                  })
                }
                className={props.isLoading ? "disabled" : ""}
              >
                Start Volume Bot
              </Button>
              <Button
                Button
                variant="dark"
                className={props.isLoading ? "disabled" : ""}
                onClick={() =>
                  props.volumeBotUpdate({
                    minSeconds: minSeconds,
                    maxSeconds: maxSeconds,
                    minVolume: minVolume,
                    maxVolume: maxVolume,
                    exchange: props.exchange,
                    pair: props.pair,
                    status: "stop",
                  })
                }
              >
                Stop Volume Bot
              </Button>
            </div>
          </Form.Group>
        </Form>
      </div>
    </Col>
  );
};
export default VolumeBotCard;

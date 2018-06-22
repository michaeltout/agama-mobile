import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { translate } from '../translate/translate';
import {
  isNumber,
  explorers,
  isAssetChain,
  formatValue,
  convertURIToImageData,
  getLocalStorageVar,
} from '../actions/utils';
import { decryptkey } from '../actions/seedCrypt';
import jsQR from 'jsqr';

class SendCoin extends React.Component {
  constructor() {
    super();
    this.state = {
      sendAmount: 0,
      sendTo: '',
      sendCurrentStep: 0,
      sendResult: {},
      spvVerificationWarning: false,
      spvPreflightSendInProgress: false,
      validNan: false,
      validTooMuch: false,
      validIncorrectAddress: false,
      qrScanError: false,
      wrongPin: false,
      pin: '',
      processing: false,
    };
    this.defaultState = JSON.parse(JSON.stringify(this.state));
    this.changeSendCoinStep = this.changeSendCoinStep.bind(this);
    this.updateInput = this.updateInput.bind(this);
    this.scanQR = this.scanQR.bind(this);
    this.validate = this.validate.bind(this);
    this.decodeSeed = this.decodeSeed.bind(this);
    this.openExternalURL = this.openExternalURL.bind(this);
  }

  renderTxID() {
    const _txid1 = this.state.sendResult.result.txid.substr(0, 31);
    const _txid2 = this.state.sendResult.result.txid.substr(31, 64);

    return (
      <div>
        <div>{ _txid1 }</div>
        <div>{ _txid2 }</div>
      </div>
    );
  }

  decodeSeed() {
    const _encryptedKey = getLocalStorageVar('seed');
    const _decryptedKey = decryptkey(this.state.pin, _encryptedKey.encryptedKey);

    if (_decryptedKey) {
      this.setState({
        wrongPin: false,
      });

      return true;
    } else {
      this.setState({
        wrongPin: true,
      });

      return false;
    }
  }

  openExternalURL(url) {
    window.open(url, '_system');
  }

  scanQR() {
    const width = 480;
    const height = 640;

    MeteorCamera.getPicture({ quality: 100 }, (error, data) => {
      if (error) {
        // console.warn(error);
        this.setState({
          qrScanError: true,
        });
      } else {
        convertURIToImageData(data)
        .then((imageData) => {
          /*console.log(imageData.data);
          console.log(imageData.height);
          console.log(imageData.width);*/
          const decodedQR = jsQR.decodeQRFromImage(imageData.data, imageData.width, imageData.height);
          // console.warn(decodedQR);

          if (!decodedQR) {
            this.setState({
              qrScanError: true,
            });
          } else {
            this.setState({
              qrScanError: false,
              sendTo: decodedQR,
            });
          }
        });
      }
    });
  }

  componentWillReceiveProps(props) {
    if (props &&
        (props.activeSection !== 'send' || this.props.coin !== props.coin)) {
      // reset form state
      this.setState(this.defaultState);
    }
  }

  updateInput(e) {
    this.setState({
      [e.target.name]: e.target.value,
    });
  }

  validate() {
    let _isFailed = false;
    let validTooMuch = false;
    let validIncorrectAddress = false;
    let validNan = false;

    if (this.state.sendAmount > this.props.balance.balance) {
      validTooMuch = true;
      _isFailed = true;
    }

    if (this.state.sendTo.length < 34 ||
        this.state.sendTo.length > 36) {
      validIncorrectAddress = true;
      _isFailed = true;
    }

    if (!isNumber(this.state.sendAmount)) {
      validNan = true;
      _isFailed = true;
    }

    if (this.state.sendCurrentStep === 1 &&
        getLocalStorageVar('settings') &&
        getLocalStorageVar('settings').requirePin &&
        !this.decodeSeed()) {
      _isFailed = true;
    }

    this.setState({
      validTooMuch,
      validIncorrectAddress,
      validNan,
    });

    return _isFailed;
  }

  changeSendCoinStep(step, back) {
    console.warn(step);
    if (back) {
      this.setState({
        sendCurrentStep: step,
        validIncorrectAddress: false,
        validTooMuch: false,
        validNan: false,
        pin: '',
        wrongPin: false,
      });
    } else {
      console.warn(this.validate());
      if (!this.validate()) {
        switch(step) {
          case 0:
            this.setState(this.defaultState);
            break;
          case 1:
            this.setState({
              spvPreflightSendInProgress: true,
              currentStep: step,
            });

            // spv pre tx push request
            this.props.sendtx(
              this.props.coin,
              this.state.sendTo,
              Math.abs(this.state.sendAmount * 100000000),
              true,
              false
            )
            .then((sendPreflight) => {
              if (sendPreflight &&
                  sendPreflight.msg === 'success') {
                this.setState({
                  spvVerificationWarning: !sendPreflight.result.utxoVerified,
                  spvPreflightSendInProgress: false,
                });
              } else {
                this.setState({
                  spvPreflightSendInProgress: false,
                });
              }
            });

            this.setState({
              sendCurrentStep: 1,
            });
            break;
          case 2:
            this.setState({
              sendCurrentStep: 2,
              processing: true,
            });

            this.props.sendtx(
              this.props.coin,
              this.state.sendTo,
              Math.abs(this.state.sendAmount * 100000000),
              null,
              true
            )
            .then((res) => {
              // console.warn('sendtx result');
              // console.warn(res);

              this.setState({
                sendResult: res,
                processing: false,
              });
            });
            break;
        }
      }
    }
  }

  sendFormRender() {
    return (
      <form
        method="post"
        autoComplete="off">
        <div className="edit">
          <label className="control-label padding-bottom-10">
            { translate('SEND.FROM') } <strong>[ <span className="success">{ formatValue(this.props.balance.balance) } { this.props.coin.toUpperCase() }</span> ]</strong>
          </label>
          <div className="shade">{ this.props.address }</div>
        </div>
        <div className="row">
          <div className="edit">
            <label
              className="control-label"
              htmlFor="kmdWalletSendTo">{ translate('SEND.TO') }</label>
            <input
              type="text"
              className="form-control"
              name="sendTo"
              onChange={ this.updateInput }
              value={ this.state.sendTo }
              id="kmdWalletSendTo"
              placeholder={ translate('SEND.ENTER_AN_ADDRESS') }
              autoComplete="off"
              required />
          { this.state.validIncorrectAddress &&
            <div className="error margin-top-15">
              <i className="fa fa-warning"></i> { translate('SEND.ADDRESS_IS_INCORECT') }
            </div>
          }
          </div>
          <div className="edit">
            <label
              className="control-label"
              htmlFor="kmdWalletAmount">
              { translate('SEND.AMOUNT') }
            </label>
            <input
              type="text"
              className="form-control"
              name="sendAmount"
              value={ this.state.sendAmount !== 0 ? this.state.sendAmount : '' }
              onChange={ this.updateInput }
              id="kmdWalletAmount"
              placeholder="0.000"
              autoComplete="off" />
            { this.state.validNan &&
              <div className="error margin-top-15">
                <i className="fa fa-warning"></i> { translate('SEND.NAN') }
              </div>
            }
            { this.state.validTooMuch &&
              <div className="error margin-top-15">
                <i className="fa fa-warning"></i> { translate('SEND.TOO_MUCH', `${this.props.balance.balance} ${this.props.coin.toUpperCase()}`) }
              </div>
            }
          </div>
          { this.state.qrScanError &&
            <div className="error margin-top-15 text-center">
              <i className="fa fa-warning"></i> { translate('SEND.QR_SCAN_ERR') }
            </div>
          }
          <div>
            <div
              disabled={
                !this.state.sendTo ||
                !this.state.sendAmount
              }
              onClick={ () => this.changeSendCoinStep(1) }
              className="group3 margin-top-50">
              <div className="btn-inner">
                <div className="btn">{ translate('SEND.SEND') }</div>
                <div className="group2">
                  <div className="rectangle8copy"></div>
                  <img className="path6" src="/images/template/login/reset-password-path-6.png" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    );
  }

  render() {
    if (this.props.activeSection === 'send') {
      return (
        <div className="form send">
          <div className="steps margin-top-10">
            <div className={ 'step' + (this.state.sendCurrentStep === 0 ? ' current' : '') }></div>
            <div className={ 'step' + (this.state.sendCurrentStep === 1 ? ' current' : '') }></div>
            <div className={ 'step' + (this.state.sendCurrentStep === 2 ? ' current' : '') }></div>
          </div>

          <div className={ 'send-step' + (this.state.sendCurrentStep === 0 ? '' : ' hide') }>
            <div className="margin-bottom-40">
              <div className="step-title">{ translate('SEND.FILL_IN_DETAILS') }</div>
              <div
                onClick={ this.scanQR }
                className="scan-qr">
                <i className="fa fa-qrcode"></i>
              </div>
            </div>
            { this.sendFormRender() }
          </div>

          <div className={ 'send-step' + (this.state.sendCurrentStep === 1 ? '' : ' hide') }>
            <div className="send-step2">
              <div className="margin-bottom-35">
                <div className="step-title">{ translate('SEND.CONFIRM') }</div>
              </div>
              <div className="margin-top-5 edit">
                <strong>{ translate('SEND.TO') }</strong>
              </div>
              <div className="edit">
                <span className="shade">{ this.state.sendTo }</span>
              </div>
              <div className="padding-top-15 edit">
                <strong>{ translate('SEND.AMOUNT') }</strong>
              </div>
              <div className="edit">
                <span className="shade">
                { this.state.sendAmount } { this.props.coin.toUpperCase() }
                </span>
              </div>
            </div>

            { this.state.spvPreflightSendInProgress &&
              <div className="padding-top-20 fs14 text-center">{ translate('SEND.SPV_VERIFYING') }...</div>
            }
            { this.state.spvVerificationWarning &&
              <div className="padding-top-20 fs14 lh25">
                <i className="fa fa-warning warning"></i> <strong className="warning">{ translate('SEND.WARNING') }:</strong> { translate('SEND.WARNING_SPV_P1') }<br />
                { translate('SEND.WARNING_SPV_P2') }
              </div>
            }
            { getLocalStorageVar('settings') &&
              getLocalStorageVar('settings').requirePin &&
              <div className="padding-top-20">
                <div className="edit pin-confirm">
                  <input
                    type="password"
                    className="form-control"
                    name="pin"
                    value={ this.state.pin }
                    onChange={ this.updateInput }
                    placeholder="Enter your PIN"
                    autoComplete="off" />
                </div>
              </div>
            }
            { this.state.wrongPin &&
              <div className="error margin-top-15 margin-bottom-25 fs14">
                <i className="fa fa-warning"></i> { translate('LOGIN.WRONG_PIN') }
              </div>
            }
            <div className="widget-body-footer">
              <div className="group3 margin-top-50">
                <div
                  onClick={ () => this.changeSendCoinStep(0, true) }
                  className="btn-inner pull-left">
                  <div className="btn">{ translate('SEND.BACK') }</div>
                  <div className="group2">
                    <img className="path6" src="/images/template/menu/trends-combined-shape.png" />
                  </div>
                </div>
                <div
                  onClick={ () => this.changeSendCoinStep(2) }
                  className="btn-inner pull-right">
                  <div className="btn">{ translate('SEND.CONFIRM') }</div>
                  <div className="group2">
                    <div className="rectangle8copy"></div>
                    <img className="path6" src="/images/template/login/reset-password-path-6.png" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={ 'send-step' + (this.state.sendCurrentStep === 2 ? '' : ' hide') }>
            <div className="step-title">{ translate('SEND.TX_RESULT') }</div>
            <div className="margin-top-35">
              { this.state.sendResult &&
                this.state.sendResult.msg === 'success' &&
                <div className="send-result">
                  <div className="edit success">
                    Success <i className="fa fa-check"></i>
                  </div>
                  <div className="edit">
                    { translate('SEND.FROM') }
                    <div className="shade margin-top-5">{ this.props.address }</div>
                  </div>
                  <div className="edit">
                    { translate('SEND.TO') }
                    <div className="shade margin-top-5">{ this.state.sendTo }</div>
                  </div>
                  <div className="edit">
                    { translate('SEND.AMOUNT') }
                    <div className="shade margin-top-5">{ this.state.sendAmount } { this.props.coin.toUpperCase() }</div>
                  </div>
                  <div className="edit">
                    Transaction ID
                    <div className="shade margin-top-5">{ this.state.sendResult && this.state.sendResult.result && this.state.sendResult.result.txid ? this.renderTxID() : translate('SEND.PROCESSING_SM') }</div>
                  </div>
                  { (isAssetChain(this.props.coin) || this.props.coin === 'chips') &&
                      this.state.sendResult &&
                      this.state.sendResult.result &&
                      this.state.sendResult.result.txid &&
                    <div className="edit">
                      <span onClick={ () => this.openExternalURL(`${explorers[this.props.coin.toUpperCase()]}/tx/${this.state.sendResult.result.txid}`) }>
                        Open in explorer<i className="fa fa-external-link margin-left-10"></i>
                      </span>
                    </div>
                  }
                </div>
              }
              { (!this.state.sendResult || this.state.processing) &&
                <div className="send-result">
                  <div className="edit">
                  { translate('SEND.PROCESSING_TX') }
                  </div>
                </div>
              }
              { this.state.sendResult &&
                this.state.sendResult.msg &&
                this.state.sendResult.msg === 'error' &&
                <div className="send-result">
                  <div className="edit error">
                  { translate('SEND.ERROR') } <i className="fa fa-close"></i>
                  </div>
                  <div className="edit">
                    <div className="shade">{ this.state.sendResult.result }</div>
                    { this.state.sendResult.raw &&
                      this.state.sendResult.raw.txid &&
                      <div className="shade">{ this.state.sendResult.raw.txid.replace(/\[.*\]/, '') }</div>
                    }
                  </div>
                </div>
              }
            </div>
            <div
              onClick={ () => this.changeSendCoinStep(0) }
              className="group3 margin-top-50">
              <div className="rectangle10copy"></div>
              <div className="btn">{ translate('SEND.MAKE_ANOTHER_TX') }</div>
              <div className="group2">
                <div className="rectangle8copy"></div>
                <img className="path6" src="/images/template/login/reset-password-path-6.png" />
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      return null;
    }
  }
}

export default SendCoin;
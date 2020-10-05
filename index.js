const soap = require('soap');

const RF_URL = 'rapidfulfillmentcrm.co.uk/api/soap/?wsdl';
const TEST_PREFIX = 'test';
const API_PROTOCOL = 'https://';


const HandleErrors = (error) => {
    if (error.isOperational) {
        console.error(error.root.Envelope.Body.Fault.faultcode, error.root.Envelope.Body.Fault.faultstring)
        return error.root.Envelope.Body.Fault.faultcode
    }
    else {
        throw Error(error)
    }
}

class RapidFulfillment {
    constructor (credentials, clientSubdomain, testMode=false) {
        this.username = credentials.username;
        this.password = credentials.password;
        this.subDomain = clientSubdomain;
        this.testMode = testMode;
        this.URL = `${API_PROTOCOL}${this.subDomain}.${(this.testMode ? TEST_PREFIX + '.' : '')}${RF_URL}`;
        this.sessionId = '';
        this.client = undefined;
    }

    login = (username=this.username, password=this.password) => {
        let _this = this
        let args = {username: username, password: password}
        return new Promise((resolve, reject) => {
            if (this.client && this.client.login)
            {
                this.client.login(args, function(err, data){
                    if (err) {
                        console.error(err);
                        reject(err);
                    }
                    _this.sessionId = data.sessionId["$value"];
                    resolve(data.sessionId["$value"])
                })

            }
            else {
                soap.createClientAsync(this.URL, {namespaceArrayElements: false}).then((client) => {
                    _this.client = client;
                    client.login(args, function(err, data){
                        if (err) {
                            console.error(err);
                            reject(err);
                        }
                        _this.sessionId = data.sessionId["$value"];
                        resolve(data.sessionId["$value"])
                    })
                })
            }
        })
    }

    api = (method, args={}) => {
        let _this = this;

        const methodCall = (method, args) => {
            return new Promise((resolve, reject) => {
                this.client[method+'Async'](args)
                .then((data) => {
                    resolve(data);
                })
                .catch(e => {
                    if (e.isOperational && e.root.Envelope.Body.Fault.faultcode == 6) {
                        resolve([])
                    }
                    reject(e);
                });
            })
        }

        return new Promise((resolve, reject) => {
            if (!this.sessionId)
            {
                this.login()
                .then((sessionId) => {
                    args.sessionId = sessionId;
                    methodCall(method, args)
                    .then((data) => {
                        const result = data.length ? data[0].methods : {};
                        resolve(result)
                    })
                    .catch(e => {
                        reject(HandleErrors(e))
                    })
                })
                .catch(e => {
                    reject(e);
                })
            }
            else {
                args.sessionId = this.sessionId;
                methodCall(method, args)
                .then((data) => {
                    const result = data.length ? data[0].methods : {};
                    resolve(result)
                })
                .catch((e) => {
                    if (e.isOperational && e.root.Envelope.Body.Fault.faultcode == 1){
                        this.login()
                        .then((sessionId) => {
                            args.sessionId = sessionId
                            methodCall(method, args)
                            .then((data) => {
                                const result = data.length ? data[0].methods : {};
                                resolve(result)
                            })
                            .catch(e => {
                                reject(e);
                            })
                        })
                        .catch(e => reject(e))
                    }
                    reject(e)
                })
            }
        })
    }
}

module.exports = RapidFulfillment;
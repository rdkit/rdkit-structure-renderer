// Copyright (c) 2022, Novartis Institutes for BioMedical Research
//
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//     * Neither the name of Novartis Institutes for BioMedical Research Inc.
//       nor the names of its contributors may be used to endorse or promote
//       products derived from this software without specific prior written
//       permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//

import {
    getMolSafe,
    getMolFromUInt8Array,
    getNormPickle,
    isBase64Pickle,
    extractBase64Pickle,
    getPickleSafe,
    setNewCoords,
    getDepiction
} from './utils.js';

class Dispatcher {
    constructor(id, minimalLibPath) {
        this.id = id;
        this._allocated = false;
        this._busy = false;
        this._ready = false;
        this._worker = this._createWorker(minimalLibPath);
    }

    /**
     * Generates and returns the code to be executed by the worker.
     * @param {number} id worker id
     * @returns the code to be executed by the worker
     */
     getWorkerBlob(minimalLibPath) {
        return [
`importScripts('${minimalLibPath}/RDKit_minimal.js');
const rdkitReady = initRDKitModule({
    locateFile: (path) => '${minimalLibPath}/' + path,
});
const ${isBase64Pickle.name} = ${isBase64Pickle};
const ${extractBase64Pickle.name} = ${extractBase64Pickle};
const ${getMolFromUInt8Array.name} = ${getMolFromUInt8Array};
const ${getPickleSafe.name} = ${getPickleSafe};
const ${getMolSafe.name} = ${getMolSafe};
const ${getNormPickle.name} = ${getNormPickle};
const ${setNewCoords.name} = ${setNewCoords};
const getDepiction = ${getDepiction};

const main = (rdkitReady, dispatcherId) => {
    onmessage = ({ data }) => rdkitReady.then(rdkitModule => {
        const { wPort } = data;
        if (!wPort) {
            return;
        }
        delete data.wPort;
        data.rdkitModule = rdkitModule;
        wPort.postMessage(getDepiction(data));
        wPort.close();
    });
    console.log('worker ' + dispatcherId.toString() + ' ready');
};
main(rdkitReady, ${this.id});`
        ];
    }

    /**
     * Create a WebWorker and initialize it with
     * an id. Pre-load RDKit_minimal.js and run code blob.
     * @returns {Worker} the created WebWorker
     */
    _createWorker(minimalLibPath) {
        if (!window.Worker) {
            throw Error("Workers are not supported");
        }
        return new Promise(resolve => {
            const blob = new Blob(this.getWorkerBlob(minimalLibPath));
            const url = window.URL || window.webkitURL;
            const blobUrl = url.createObjectURL(blob);
            resolve(new Worker(blobUrl));
        });
    }

    /**
     * Return true if the Dispatcher is allocated, false if not.
     * @returns {boolean} isAllocated status
     */
    isAllocated() {
        return this._allocated;
    }

    /**
     * Set the allocated status on this Dispatcher.
     * @param {boolean} isAllocated
     */
    setIsAllocated(isAllocated) {
        this._allocated = isAllocated;
    }

    /**
     * Return true if the Dispatcher is busy, false if not.
     * @returns {boolean} isBusy status
     */
    isBusy() {
        return this._busy;
    }

    /**
     * Set the busy status on this Dispatcher.
     * @param {boolean} isBusy
     */
    setIsBusy(isBusy) {
        this._busy = isBusy;
    }

    /**
     * Post message to the WebWorker associated to this Dispatcher.
     */
    async postMessage(...args) {
        const _throwError = (attr) => {
            throw Error(`Cannot post msg to ${attr} Dispatcher`);
        };
        if (!this._allocated) {
            _throwError('an unallocated');
        }
        if (this._busy) {
            _throwError('a busy');
        }
        this._busy = true;
        if (!this._ready) {
            let tid;
            let port1;
            const TIMEOUT = 50;
            const _parseMsg = (resolve) => {
                port1.close();
                if (typeof resolve === 'function') {
                    if (tid) {
                        clearInterval(tid);
                    }
                    resolve(true);
                } else {
                    port1 = _sendMsg();
                }
            };
            const _sendMsg = () => {
                const msgChannel = new MessageChannel();
                const pingMsg = { wPort: msgChannel.port2 };
                msgChannel.port1.onmessage = () => _parseMsg(_sendMsg.resolve);
                (async () => (await this._worker).postMessage(pingMsg, [msgChannel.port2]))();
                return msgChannel.port1;
            };
            this._ready = await new Promise(resolve => {
                _sendMsg.resolve = resolve;
                port1 = _sendMsg();
                tid = setInterval(_parseMsg, TIMEOUT);
            });
        }
        (await this._worker).postMessage(...args);
    }
}

export default Dispatcher;

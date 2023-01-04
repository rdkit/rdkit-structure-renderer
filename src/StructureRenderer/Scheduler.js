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

import MainQueue from './MainQueue.js';

class Scheduler {
    constructor({ getDispatchers, cleanupFunc }) {
        this.mainQueue = new MainQueue(this, cleanupFunc);
        this._token = 0;
        this._dispatcherMap = new Map();
        this._dispatchers = getDispatchers();
    }

    /**
     * Return null if there is no available WebWorker.
     * If there is an available WebWorker, book it with
     * a token and return the token.
     * @returns {number} the token for the allocated WebWorker
     */
    get() {
        let token = null;
        const freeDispatchers = this._dispatchers.filter((w) => !w.isAllocated());
        if (freeDispatchers.length) {
            token = this._token;
            const freeDispatcher = freeDispatchers[0];
            freeDispatcher.setIsAllocated(true);
            this._dispatcherMap.set(token, freeDispatcher);
            if (++this._token === Number.MAX_SAFE_INTEGER) {
                this._token = 0;
            }
        }
        return token;
    }

    /**
     * Return the Dispatcher associated to a token obtained
     * from a prior call to Scheduler.get().
     * @param {number} token token for the allocated Dispatcher
     * @returns the allocated Dispatcher
     */
    dispatcher(token) {
        const d = this._dispatcherMap.get(token);
        if (!d) {
            throw Error(`There is no Dispatcher associated to token ${token}`);
        }
        this._dispatcherMap.delete(token);
        return d;
    }

    /**
     * Submit a job to a Dispatcher.
     * @param  {Object} msg the msg describing the job
     * @param  {Object} token the token obtained by a prior call to Scheduler.get()
     * @returns {Object} a Promise that will resolve to the computed result
     * when the job is completed
     */
    submit(msg, token) {
        return new Promise((resolve) => {
            const dispatcher = this.dispatcher(token);
            const msgChannel = new MessageChannel();
            msg.wPort = msgChannel.port2;
            msgChannel.port1.onmessage = ({ data }) => {
                msgChannel.port1.close();
                dispatcher.setIsAllocated(false);
                dispatcher.setIsBusy(false);
                // flush child queues first
                const hasTokens = this.mainQueue.children().every((child) => child.flush());
                this.mainQueue.removeEmptyChildren();
                // if there are still tokens, flush the main queue
                if (hasTokens) {
                    this.mainQueue.flush();
                }
                resolve(data);
            };
            dispatcher.postMessage(msg, [msgChannel.port2]);
        });
    }
}

export default Scheduler;

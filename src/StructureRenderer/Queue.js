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

/**
 * Base class for managing a msg queue
 */
 class Queue {
    constructor() {
        this._q = [];
    }

    /**
     * Returns true if the queue is empty, false if not.
     * @returns {boolean} true if the queue is empty.
     */
    isEmpty() {
        return (!this._q.length);
    }

    /**
     * Keep shifting messages from the top of the queue until
     * one with non-null type and qPort is found; when one is found,
     * return it without shifting it.
     * @returns {Object} first msg with non-null type or undefined
     * if no such msg is found
     */
    peek() {
        let res;
        while (this._q.length) {
            const msg = this._q[0];
            // ignore msg with null type or qPort (done or aborted)
            if (msg.type && msg.qPort) {
                res = msg;
                break;
            }
            this._q.shift();
        }
        return res;
    }

    /**
     * Go through queued messages; for those whose divId
     * is equal to msgDivId, set their type to null and
     * send a shouldAbort msg to their qPort
     * @param {string} msgDivId divId to look for
     */
    purge(msgDivId) {
        const shouldAbort = true;
        this._q.forEach(qMsg => {
            if (msgDivId === qMsg.divId) {
                if (qMsg.type && qMsg.qPort) {
                    qMsg.type = null;
                    qMsg.qPort.postMessage({ shouldAbort });
                    qMsg.qPort.close();
                }
            }
        });
    }

    /**
     *
     * @param {Object} msg message to be submitted to the WebWorker
     * @returns {Promise} a Promise that will resolve to the the
     * result when the job is completed, or to null is the job
     * is aborted before being submitted
     */
    submitWhenWorkerAvailable(msg) {
        return new Promise(resolve => {
            const msgChannel = new MessageChannel();
            msg.qPort = msgChannel.port2;
            msgChannel.port1.onmessage = ({ data }) => {
                msgChannel.port1.close();
                const { shouldAbort, token } = data;
                delete msg.qPort;
                resolve(shouldAbort ? Promise.resolve(null) : this.scheduler().submit(msg, token));
            };
        });
    }

    /**
     * Shift jobs from the top of the queue and submit them
     * to the Scheduler until there are msgs and until
     * Scheduler.get() returns non-null response.
     * @returns {boolean}  false if there are no more tokens
     * available, true if there potentially are
     */
    flush() {
        const shouldAbort = false;
        let canSubmit = true;
        let keepFlushing = true;
        while (keepFlushing) {
            const qMsg = this.peek();
            // bail out if there are no more messages
            if (!qMsg) {
                break;
            }
            // try to allocate a Dispatcher
            const token = this.scheduler().get();
            // if we got a null token, stop flushing
            if (token === null) {
                canSubmit = false;
                break;
            }
            qMsg.qPort.postMessage({ shouldAbort, token });
            qMsg.qPort.close();
            keepFlushing = this.shouldFlush();
        }
        return canSubmit;
    }
}

/**
 * MainQueue class:
 * - maintains a queue of jobs
 * - maintains a key, value dictionary of childQueues which
 *   are tied to a specific divId when a job is submitted
 *   by the SettingsDialog
 * - submits jobs to the Scheduler if not busy
 */
 class MainQueue extends Queue {
    constructor(scheduler, cleanupFunc) {
        super();
        this._scheduler = scheduler;
        this._children = {};
        this._cleanup = cleanupFunc;
    }

    /**
     * Scheduler accessor.
     * @returns {Scheduler} the Scheduler associated to this queue
     */
    scheduler() {
        return this._scheduler;
    }

    /**
     * In the MainQueue, a msg should be shifted
     * from the queue immediately after being submitted
     * to the Dispatcher, to allow further flushing.
     * @returns {boolean} always true
     */
    shouldFlush() {
        this._q.shift();
        return true;
    }

    /**
     * Assign a new ChildQueue to this divId.
     * @param {string} divId
     * @returns {Object} the ChildQueue assigned to this divId.
     */
    addChild(divId) {
        const childQueue = new ChildQueue(this, divId);
        this._children[divId] = childQueue;
        return childQueue;
    }

    /**
     * Remove the ChildQueue assigned to this divId.
     * @param {string} divId
     */
    removeChild(divId) {
        delete this._children[divId];
    }

    /**
     * Returns the array of children queues associated
     * to this MainQueue.
     * @returns {Array<ChildQueue>} an array of ChildQueue
     */
    children() {
        return Object.values(this._children);
    }

    /**
     * Loops through the {divId: ChildQueue} dictionary and removes
     * empty entries; quits the loop at the first non-empty entry.
     */
    removeEmptyChildren() {
        Object.entries(this._children).every(([divId, child]) => {
            const isEmpty = child.isEmpty();
            if (isEmpty) {
                this.removeChild(divId);
                this._cleanup && this._cleanup(divId);
            }
            return isEmpty;
        });
    }

    /**
     * Submit a job to this MainQueue.
     * @param  {Object} msg the msg describing the job
     * @returns {Promise} a Promise that will resolve to the
     * result when the job is completed, or to null is the job
     * is aborted before being submitted
     */
    submit(msg) {
        const res = this.submitWhenWorkerAvailable(msg);
        this._q.push(msg);
        this.flush();
        return res;
    }

    /**
     * Abort jobs connected to divId, whether they are
     * in the main queue or in any child queue
     * @param {string} divId jobs connected with this
     * identifier will be aborted
     */
    abortJobs(divId) {
        this.purge(divId);
        this.children().forEach(child => child.purge(divId));
        this.removeEmptyChildren(this._cleanup);
    }
}

/**
 * ChildQueue class:
 * - maintains a queue of jobs that depend on results previously
 *   submitted to the same ChildQueue
 * - submits jobs to the Scheduler if not busy
 */
 class ChildQueue extends Queue {
    constructor(mainQueue, divId) {
        super();
        this._mainQueue = mainQueue;
        this.divId = divId;
    }

    /**
     * Scheduler accessor.
     * @returns {Scheduler} the Scheduler associated to this queue
     */
    scheduler() {
        return this._mainQueue.scheduler();
    }

    /**
     * In a ChildQueue, a msg should be shifted from
     * the queue only after it has been completed by the
     * Dispatcher, and no more flushing should occur.
     * @returns always false
     */
    shouldFlush() {
        return false;
    }

    /**
     * Create a hash to identify a msg. The hash is a pipe-separated string:
     * msgDivId|msgType|msgMolText
     * @param {Object} msg the msg for which a hash is to be computed
     * @returns {string} the computed hash
     */
    computeHash(msg) {
        let hash = msg.divId + '|' + msg.type + '|' + msg.molText;
        if (msg.scaffoldText) {
            hash += '|' + msg.scaffoldText;
        }
        if (msg.opts) {
            hash += '|' + Object.keys(msg.opts).sort().map(k => msg[k]).join('|');
        }
        return hash;
    }

    /**
     * Submit a job to this ChildQueue.
     * @param  {Object} msg the msg describing the job
     * @returns {Promise} a Promise that will resolve to the
     * result when the job is completed, or to null is the job
     * is aborted before being submitted
     */
    submit(msg) {
        const res = this.submitWhenWorkerAvailable(msg);
        this._q.push(msg);
        const hash = this.computeHash(msg);
        const lastIdx = this._q.length - 1;
        let shouldAbort = false;
        this._q.forEach((qMsg, i) => {
            if (qMsg.type) {
                if (shouldAbort) {
                    qMsg.type = null;
                    qMsg.qPort.postMessage({ shouldAbort });
                    qMsg.qPort.close();
                } else if (i !== lastIdx && this.computeHash(qMsg) === hash) {
                    shouldAbort = true;
                }
            }
        });
        if (!shouldAbort && this._q.length === 1) {
            this.flush();
        }
        return res;
    }
}

export { Queue, MainQueue, ChildQueue };

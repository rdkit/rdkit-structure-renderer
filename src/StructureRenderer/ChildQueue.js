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

import Queue from './Queue.js';

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
        let hash = `${msg.divId}|${msg.type}|${msg.molText}`;
        if (msg.scaffoldText) {
            hash += `|${msg.scaffoldText}`;
        }
        if (msg.opts) {
            const hashedOpts = Object.keys(msg.opts).sort().map((k) => msg[k]).join('|');
            hash += `|${hashedOpts}`;
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

export default ChildQueue;

// Copyright (c) 2022-2023, Novartis Institutes for BioMedical Research
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

import Queue from './Queue';
import ChildQueue from './ChildQueue';

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
                if (this._cleanup) {
                    this._cleanup(divId);
                }
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
        this.children().forEach((child) => child.purge(divId));
        this.removeEmptyChildren(this._cleanup);
    }
}

export default MainQueue;

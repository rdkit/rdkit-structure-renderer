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

import { v4 as uuidv4 } from 'uuid';
import { changeDpiBlob } from 'changedpi';
import defaultRendererCss from './style';
import defaultDialogHtml from './dialog';
import defaultIcons from './icons';
import Scheduler from './Scheduler';
import Dispatcher from './Dispatcher';
import LocalDispatcher from './LocalDispatcher';
import SettingsDialog from './SettingsDialog';
import ButtonTooltip from './ButtonTooltip';
import Utils from './utils';
import {
    NATIVE_CANVAS_RESOLUTION,
    DEFAULT_IMG_OPTS,
    DEFAULT_DRAW_OPTS,
    DEFAULT_MOL_OPTS,
    DEFAULT_SCAFFOLD_OPTS,
    RDK_STR_RNR,
    DIVID_SEPARATOR,
    DIV_ATTRS,
    BUTTON_TYPES,
    USER_OPTS,
    NO_MATCH,
    HAS_OWN_COORDS,
    CLIPBOARD_OPTS,
    WHL_OPTS,
    JOB_TYPES,
    OPT_TYPES,
} from './constants';

let _RDKitModule;
const haveWindow = (typeof window !== 'undefined');
const isNodeJs = (typeof process !== 'undefined' && process.release?.name === 'node' && typeof require !== 'undefined');
const _window = (haveWindow ? window : {
    devicePixelRatio: 1,
});
const haveWorker = (typeof Worker !== 'undefined');
const haveWebAssembly = (() => {
    try {
        if (typeof WebAssembly === 'object'
            && typeof WebAssembly.instantiate === 'function') {
            const wasmModule = new WebAssembly.Module(
                Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
            );
            if (wasmModule instanceof WebAssembly.Module) {
                return new WebAssembly.Instance(wasmModule) instanceof WebAssembly.Instance;
            }
        }
    } catch (e) {
        // no-op
    }
    return false;
})();

const Renderer = {
    /**
     * Override to change, by default returns true on IE11.
     * @returns {boolean} whether this is running on a legacy browser
     */
    getIsLegacyBrowser: () => haveWindow && !window.ActiveXObject && 'ActiveXObject' in window,
    /**
     * Override to change, currently hardware concurrency minus 2.
     * @returns {number} Hardware concurrency
     */
    getHardwareConcurrency: () => Math.max(((typeof navigator !== 'undefined'
        && navigator.hardwareConcurrency) || 1) - 2, 1),

    /**
     * Override to change, currently capped to 8.
     * @returns {number} Maximum allowed concurrency independently of hardware
     */
    getMaxConcurrency: () => (haveWebAssembly && haveWorker ? 8 : 0),

    /**
     * Override for custom HTML.
     * @returns {string} HTML used by SettingsDialog
     */
    getDialogHtml: () => defaultDialogHtml,

    /**
     * Override to get an array of Dispatchers.
     * Currently returns null, which means we spawn our own.
     * @returns {Array<Dispatcher>} array of Dispatchers
     */
    getDispatchers: () => null,

    /**
     * Override to use an existing RDKitModule.
     * @returns {Promise} promise that resolves to RDKitModule
     */
    async getRDKitModule() {
        await this.init();
        return _RDKitModule;
    },

    /**
     * Override to use custom default get_mol options
     * for the molecule.
     * @returns {object} default get_mol options
     * for the molecule
     */
    getDefaultMolOpts: () => DEFAULT_MOL_OPTS,

    /**
     * Override to use custom default get_mol options
     * for the scaffold.
     * @returns {object} default get_mol options
     * for the scaffold
     */
    getDefaultScaffoldOpts: () => DEFAULT_SCAFFOLD_OPTS,

    /**
     * Override to use custom default drawing options.
     * @returns {object} default drawing options
     */
    getDefaultDrawOpts: () => DEFAULT_DRAW_OPTS,

    /**
     * Return default drawing option k.
     * @returns {object} default drawing option k
     */
    getDefaultDrawOpt(k) {
        return this.getDefaultDrawOpts()[k];
    },

    /**
     * Override to change clipboard options.
     * @returns {object} clipboard options
     */
    getClipboardOpts: () => CLIPBOARD_OPTS,

    /**
     * Override to change spinning wheel settings.
     * @returns {object} spinning wheel settings
     */
    getWhlOpts: () => WHL_OPTS,

    /**
     * Override to change the name of the class used
     * to style the mol container.
     * @returns {object} clipboard options
     */
    getContainerClassName() {
        return `${this.getDivIdPrefix()}container`;
    },

    /**
     * Override to change how the complete divId is generated.
     * @returns {string} the complete divId
     */
    getDivIdTag(divIdIn, uniqueId) {
        let divId = divIdIn;
        if (typeof uniqueId !== 'undefined' && uniqueId !== null) {
            divId += `${this.getDivIdSeparator()}${uniqueId}`;
        }
        return divId;
    },

    /**
     * Override to use a different RdkStrRnr prefix.
     * @returns {string} the RdkStrRnr prefix
     */
    getRdkStrRnrPrefix: () => RDK_STR_RNR,

    /**
     * Override to use a different divId prefix.
     * @returns {string} the divId prefix
     */
    getDivIdPrefix() {
        return `${this.getRdkStrRnrPrefix()}mol-`;
    },

    /**
     * Override to use a different separator in divId.
     * The divId may consist of one or two parts, separated by
     * a separator. If the separator is present, only the divId
     * portion on the rhs of the separator is used to retrieve
     * cached settings from userOptCache. This mechanism allows
     * to tie a set of userOpts to multiple divIds, having a
     * different lhs but the same rhs.
     * @returns {string} the divId prefix
     */
    getDivIdSeparator: () => DIVID_SEPARATOR,

    /**
     * Override to use a different set of divId tags.
     * @returns {object} a dictionary mapping tag keys to tag names
     */
    getDivAttrs() {
        if (!this._divAttrs) {
            this._divAttrs = Object.fromEntries(DIV_ATTRS.map((k) => [k, Utils.keyToTag(k)]));
        }
        return this._divAttrs;
    },

    /**
     * Override to use different button types.
     * @returns {Array<object>} an array of objects describing
     * button names and tooltips
     */
    getButtonTypes: () => BUTTON_TYPES,

    /**
     * Override to customize the settings dialog.
     * @returns {SettingsDialog} SettingsDialog instance
     */
    createSettingsDialog() {
        return new SettingsDialog(this);
    },

    /**
     * Override to use a different CSS style.
     * @returns {object} CSS style used by Renderer as a key, value dictionary
     */
    getRendererCss: () => defaultRendererCss,

    /**
     * Sets the available user opt entries. Call with custom
     * userOpts to customize user opt entries.
     * @param {object} userOpts optional custom user opts
     */
    setAvailUserOpts(userOpts) {
        this._userOpts = Object.fromEntries(
            Object.entries(userOpts || this.getDefaultUserOpts()).map(
                ([k, opt]) => [k, { tag: Utils.keyToTag(k), opt }]
            ),
        );
    },

    /**
     * Get default user opt entries.
     * @returns {object} key, value user opt dictionary
     */
    getDefaultUserOpts: () => USER_OPTS,

    /**
     * Get available user opts as a { key: { tag, opt } } dictionary.
     * @returns {object} a dictionary relating tag keys to a { tag, opt }
     * dictionary where tag is the HTML tag name and opt is the option
     * displayed in the SettingsDialog.
     * Options can be boolean or multi-choice. If opt.label is null, the entry
     * is not displayed in the SettingsDialog, but can still be set
     * programmatically through the HTML tag
     */
    getAvailUserOpts() {
        if (!this._userOpts) {
            this.setAvailUserOpts();
        }
        return this._userOpts;
    },

    /**
     * Get current user opts for a certain key as a key, value dictionary.
     * Note that if there are multiple divs relating to the same key,
     * the values from the first div will be picked.
     * @returns {object} a dictionary relating opt name (all uppercase) to value
     */
    getUserOptsForKey(key) {
        const divId = this.getFirstDivIdFromDivIdOrKey(key);
        let div;
        if (divId) {
            div = this.getMolDiv(divId);
        }
        return this.getUserOptsForDiv(div || key) || {};
    },

    /**
     * Set user opts for a certain key from a key, value dictionary.
     * All divs related to the same key will be updated.
     * @param {object} opts dictionary relating opt name (all uppercase) to value
     */
    setUserOptsForKey(key, opts) {
        const userOpts = this.getAvailUserOpts();
        Object.entries(opts).forEach(([opt, value]) => {
            const tag = userOpts[opt]?.tag;
            if (tag) {
                this.updateUserOptCache(key, tag, value);
            }
        });
        this.getDivIdArrayFromDivIdOrKey(key).forEach(
            (divId) => this.updateMolDrawDivIfNeeded(divId)
        );
    },

    /**
     * Get boolean or string user options for a given div or divId.
     * @param {Element|string} div div or divId
     * @returns {object} dictionary mapping each userOpt key to its
     * boolean or string value
     */
    getUserOptsForDiv(div) {
        return Object.fromEntries(Object.entries(this.getAvailUserOpts()).map(
            ([k, { tag }]) => [k, this.getDivOpt(div, tag)]
        ).filter(([, v]) => typeof v !== 'undefined'));
    },

    /**
     * Number of spawned WebWorkers.
     * @returns {number} concurrency
     */
    getConcurrency() {
        if (!this._concurrency) {
            this._concurrency = Math.min(this.getHardwareConcurrency(), this.getMaxConcurrency());
        }
        return this._concurrency;
    },

    /**
     * @returns {boolean} true if RDKitModule is available
     */
    isRDKitReady() {
        if (!this._isRDKitReady) {
            this._isRDKitReady = (_RDKitModule && typeof _RDKitModule.version === 'function');
        }
        return this._isRDKitReady;
    },

    /**
     * Return div containing the SVG icon for type.
     * @param {string} type 'copy' or 'cog'
     * @returns {Element} HTML div containing the SVG icon
     */
    getButtonIcon(type) {
        const div = document.createElement('div');
        const span = document.createElement('span');
        div.appendChild(span);
        span.className = `${this.getRdkStrRnrPrefix()}button-icon`;
        span.innerHTML = defaultIcons[type];
        return div;
    },

    /**
     * @returns {string} the URL where MinimalLib JS and WASM live
     */
    getMinimalLibPath() {
        if (typeof this._minimalLibPath === 'undefined') {
            throw Error('ERROR: getMinimalLibPath() called before init()');
        }
        return this._minimalLibPath;
    },

    /**
     * Return user opts that can be changed by the user.
     * @returns {Array<object>} an array of { tag, opt } dictionaries
     */
    getInteractiveUserOpts() {
        if (!this._interactiveUserOpts) {
            this._interactiveUserOpts = Object.values(this.getAvailUserOpts()).filter(
                ({ opt }) => (opt.type && opt.label !== null)
            );
        }
        return this._interactiveUserOpts;
    },

    /**
     * Return user opts that can be toggled.
     * @returns {Array<object>} an array of { tag, opt } dictionaries
     */
    getBoolUserOpts() {
        if (!this._boolUserOpts) {
            this._boolUserOpts = Object.values(this.getAvailUserOpts()).filter(
                ({ opt }) => (opt.type === OPT_TYPES.BOOL)
            );
        }
        return this._boolUserOpts;
    },

    /**
     * Set the rdkit-structure-renderer style to the
     * passed CSS, or to the default CSS if the passed
     * css is falsy
     * @param {object} css key, value dictionary
     */
    setRendererCss(cssIn) {
        const RDK_CSS_ID = `${this.getRdkStrRnrPrefix()}css`;
        let style = document.getElementById(RDK_CSS_ID);
        // if style already exists and no css is passed,
        // do nothing
        if (style && !cssIn) {
            return;
        }
        let css = cssIn || this.getRendererCss();
        css = Utils.cssToText(css);
        if (!style) {
            style = document.createElement('style');
            const styleText = document.createTextNode(css);
            style.id = RDK_CSS_ID;
            style.setAttribute('type', 'text/css');
            style.appendChild(styleText);
            document.head.appendChild(style);
        } else {
            style.firstChild.innerHTML = css;
        }
    },

    /**
     * Called to initialize the RDKitModule used by UI and load CSS
     * into the current HTML document. If the URL of the MinimalLib
     * JS loader is provided, MinimalLib will be loaded from there,
     * otherwise it will be loaded from the default location.
     * @param {string} minimalLibPath (optional) URL containing RDKit_minimal
     * @param {string} basename (optional) basename of the main library
     * @returns {Promise} Promise that resolves to the RDKit module
     * once the latter is loaded and initialized
     */
    init(minimalLibPathIn, basenameIn, initRDKitModuleExt) {
        const takeParent = (path) => path.substring(0, path.lastIndexOf('/'));
        let basename = basenameIn;
        let minimalLibPath = minimalLibPathIn;
        if (!basename) {
            basename = Utils.getMinimalLibBasename();
            if (!haveWebAssembly) {
                basename += '_legacy';
            }
        }
        if (this.isRDKitReady()) {
            return Promise.resolve(this);
        }
        if (!this._minimalLibJs) {
            if (typeof minimalLibPath !== 'string') {
                minimalLibPath = document.currentScript?.src || '';
            }
            if (minimalLibPath.endsWith('/')) {
                minimalLibPath = takeParent(minimalLibPath);
            }
            if (minimalLibPath.endsWith('.js')) {
                minimalLibPath = takeParent(minimalLibPath);
            }
            this._minimalLibPath = minimalLibPath;
            // PKG_VERSION and MINIMALLIB_PATH are string literals which are replaced at
            // compile time by webpack.DefinePlugin, so we can silence linter warnings
            // eslint-disable-next-line no-undef
            this._minimalLibJs = `${this._minimalLibPath}/${basename}.${PKG_VERSION}.js`;
            if (isNodeJs) {
                if (typeof initRDKitModuleExt !== 'function') {
                    let msg;
                    try {
                        // eslint-disable-next-line no-undef, import/no-dynamic-require, global-require
                        const initRDKitModule = require(MINIMALLIB_PATH);
                        if (typeof initRDKitModule === 'function') {
                            _window.initRDKitModule = initRDKitModule;
                        } else {
                            msg = `initRDKitModule: expected function, got ${typeof initRDKitModule}`;
                        }
                    } catch (e) {
                        msg = e;
                    }
                    if (typeof _window.initRDKitModule !== 'function') {
                        // eslint-disable-next-line no-undef
                        throw Error(`Failed to dynamically import ${MINIMALLIB_PATH}:\n${msg}\n` +
                            'It looks like you may have moved the file elsewhere.\n' +
                            'Either restore its original location in the public directory or add\n' +
                            'const initRDKitModule = require("./public/RDKit_minimal.VERSION.js");\n' +
                            'to your NodeJS script and then call Renderer.init(minimalLibPath, null, initRDKitModule)');
                    }
                } else {
                    _window.initRDKitModule = initRDKitModuleExt;
                }
            }
            // create the Scheduler (which in turn may spawn WebWorkers)
            // if it has not been created yet
            this.scheduler();
        }
        // if the RDKit module has already been initialzed, return it
        const _loadRDKitModule = (resolve) => {
            const TIMEOUT = 50;
            const RDK_LOADER_ID = `${this.getRdkStrRnrPrefix()}loader`;
            if (typeof _RDKitModule === 'undefined') {
                // eslint-disable-next-line no-undef
                console.log(`rdkit-structure-renderer version: ${PKG_VERSION}`);
                _RDKitModule = null;
                if (haveWindow && !document.getElementById(RDK_LOADER_ID)) {
                    const rdkitLoaderScript = document.createElement('script');
                    rdkitLoaderScript.id = RDK_LOADER_ID;
                    rdkitLoaderScript.src = this._minimalLibJs;
                    rdkitLoaderScript.async = true;
                    rdkitLoaderScript.onload = () => _loadRDKitModule(resolve);
                    document.head.appendChild(rdkitLoaderScript);
                } else if (!haveWindow && !isNodeJs && typeof importScripts === 'function') {
                    // eslint-disable-next-line no-undef
                    importScripts(this._minimalLibJs);
                    // eslint-disable-next-line no-undef
                    _window.initRDKitModule = initRDKitModule;
                }
            }
            if (_window.initRDKitModule || _RDKitModule) {
                let res = this;
                if (!_RDKitModule) {
                    if (typeof _window.initRDKitModule !== 'function') {
                        throw Error('_loadRDKitModule: initRDKitModule is not a function');
                    }
                    _RDKitModule = _window.initRDKitModule({
                        // eslint-disable-next-line no-undef
                        locateFile: () => `${this._minimalLibPath}/${basename}.${PKG_VERSION}.wasm`
                    });
                    res = (async () => {
                        _RDKitModule = await _RDKitModule;
                        if (!this.isRDKitReady()) {
                            throw Error(`_loadRDKitModule: Failed to bootstrap ${this._minimalLibJs}`);
                        }
                        _window.initRDKitModule = undefined;
                        _window.RDKitStructureRenderer = this;
                        _RDKitModule.use_legacy_stereo_perception(false);
                        console.log(`RDKit version: ${_RDKitModule.version()}`);
                        return this;
                    })();
                }
                resolve(res);
            } else {
                // MinimalLib has not finished loading yet, try again after TIMEOUT ms
                setTimeout(() => resolve(new Promise(_loadRDKitModule)), TIMEOUT);
            }
        };
        return new Promise(_loadRDKitModule);
    },

    /**
     * Get the divId from a div, removing, if present, the divId prefix
     * @param {Element} div molDiv
     * @returns {string} divId
     */
    getDivId(div) {
        if (!this._divIdRe) {
            this._divIdRe = new RegExp(`^(${this.getDivIdPrefix()})?(.*)$`);
        }
        return div.id.match(this._divIdRe)[2];
    },

    /**
     * Get the cacheKey from a div or divId, removing, if present,
     * the divId prefix and, if present, the uniqueId before the ___ separator
     * @param {Element|string} div molDiv
     * @returns {string} cacheKey
     */
    getCacheKey(div) {
        if (!this._cachedKeyRe) {
            this._cachedKeyRe = new RegExp(
                `^(${this.getDivIdPrefix()})?(.*${this.getDivIdSeparator()})?(.*)$`
            );
        }
        return (typeof div === 'object' ? div.id : div).match(this._cachedKeyRe)[3];
    },

    /**
     * Return an array of optional HTML tags whose key in DIV_ATTRS
     * end with _NODE which specify the parent node the SettingsDialog div
     * should become a child of and the node after which the SettingsDialog
     * div should be inserted
     * @returns {Array<String>} HTML tag array
     */
    relatedNodes() {
        if (!this._relatedNodes) {
            this._relatedNodes = Object.keys(this.getDivAttrs()).filter(
                (v) => v.endsWith('_NODE')
            ).map((k) => this.getDivAttrs()[k]);
        }
        return this._relatedNodes;
    },

    /**
     * currentDivs accessor.
     * @returns {Map} Map of currently mounted div attributes
     */
    currentDivs() {
        if (!this._currentDivs) {
            this._currentDivs = new Map();
        }
        return this._currentDivs;
    },

    /**
     * Return div corresponding to divId.
     * @param {string} divId identifier for a div
     * @returns {Element} div corresponding to divId
     */
    getMolDiv(divId) {
        return document.querySelector(`div[id=${this.getDivIdPrefix()}${divId}]`);
    },

    /**
     * Return divs corresponding to key.
     * @param {string} key cache key
     * @returns {Array<Element>} array of currently mounted mol divs
     * corresponding to key
     */
    getMolDivsForKey(key) {
        return document.querySelectorAll(`div[id$=${this.getDivIdSeparator()}${key}`);
    },

    /**
     * Return array of currently mounted mol divs.
     * @returns {Array<Element>} array of currently mounted mol divs
     */
    getMolDivArray() {
        return document.querySelectorAll(`div[id^=${this.getDivIdPrefix()}]`);
    },

    /**
     * Return button Element with specified type for div.
     * @param {Element} div
     * @param {Element} type either 'cog' or 'copy'
     * @returns {Element} button Element
     */
    getButton: (div, type) => div.getElementsByClassName(`button ${type}`)[0],

    /**
     * Return canvas or SVG div Element for div.
     * @param {Element} div
     * @returns {Element} canvas or SVG div Element
     */
    getMolDraw: (div) => div.querySelector('[name=mol-draw]'),

    /**
     * Set the enabled/disabled status for button
     * @param {Element} button
     * @param {boolean} shouldEnable enabled/disabled status
     * @param {boolean} useGreyOut if true, grey/ungrey out button
     * and associated label (if any)
     */
    setButtonEnabled: (button, shouldEnable, useGreyOut) => {
        const modifyClass = (elem, item, disable) => {
            const re = new RegExp(`( ${item})*$`);
            elem.setAttribute('class', elem.className.replace(re, disable ? ` ${item}` : ''));
        };
        const disable = !shouldEnable;
        button.disabled = disable;
        if (useGreyOut) {
            const iconSpan = button.firstChild.firstChild;
            modifyClass(iconSpan, 'disabled-icon', disable);
            const label = button.parentNode;
            if (label?.nodeName === 'LABEL') {
                modifyClass(label, 'disabled-label', disable);
            }
        }
    },

    /**
     * Set the enabled/disabled status for existing buttons in a given div
     * @param {Element} div
     * @param {boolean} shouldEnable enabled/disabled status
     * @param {boolean} useGreyOut if true, grey/ungrey out button
     * and associated label (if any)
     */
    setButtonsEnabled(div, shouldEnable, useGreyOut) {
        this.getButtonTypes().forEach(({ type }) => {
            const button = this.getButton(div, type);
            if (button) {
                this.setButtonEnabled(button, shouldEnable, useGreyOut);
            }
        });
    },

    /**
     * Print an error message to the console if the copy
     * to clipboard operation failed.
     * @param {string} msg error message
     */
    logClipboardError: (msgIn) => {
        const msg = msgIn ? `${msgIn}\n` : '';
        console.error(`${msg}Unable to copy to clipboard`);
    },

    /**
     * Return true if clipboard can be accessed.
     * @returns {boolean} true if clipboard can be accessed
     */
    async canAccessClipboard() {
        let permissionStatus;
        try {
            permissionStatus = await navigator.permissions.query(this.getClipboardOpts());
        } catch {
            this.logClipboardError('Failed to query permissions');
            return false;
        }
        if (permissionStatus.state === 'denied') {
            this.logClipboardError('Failed to obtain permission');
            return false;
        }
        return true;
    },

    /**
     * Scheduler creator and accessor.
     * @returns {object} Scheduler
     */
    scheduler() {
        if (!this._scheduler) {
            const cleanupFunc = (divId) => {
                const currentDiv = this.currentDivs().get(divId);
                if (currentDiv) {
                    delete currentDiv.childQueue;
                }
            };
            const concurrency = this.getConcurrency();
            const getDispatchers = concurrency
                ? () => [...Array(concurrency).keys()].map(
                    (i) => new Dispatcher(i, this.getMinimalLibPath())
                ) : () => [new LocalDispatcher(0, this.getRDKitModule())];
            this._scheduler = new Scheduler({
                getDispatchers,
                cleanupFunc
            });
        }
        return this._scheduler;
    },

    /**
     * Submit msg to mainQueue or directly to a childQueue,
     * in case msg was emitted by a SettingsDialog.
     * @param {object} msg message to be submitted
     * @returns {object} a Promise that will resolve to the
     * result when the job is completed, or to null is the job
     * is aborted before being submitted
     */
    submit(msg) {
        const currentDiv = this.currentDivs().get(msg.divId) || {};
        // if this message involves the same divId as the one the
        // the SettingsDialog is currently open on and a ChildQueue
        // was assigned, submit directly to the ChildQueue, otherwise
        // submit to the MainQueue
        return (msg.divId === this.settings?.currentDivId && currentDiv.childQueue
            ? currentDiv.childQueue.submit(msg) : this.scheduler().mainQueue.submit(msg));
    },

    /**
     * Request mol pickle for a given divId.
     * @param {string} divId id of the div the molecule belongs to
     * @param {string} molDesc molecule description (SMILES, molblock or pkl_base64)
     * @param {string|null} scaffoldText scaffold description (SMILES, molblock or pkl_base64).
     * Note that the description may include multiple scaffolds, either separated by
     * a pipe symbol ('|', SMILES and pkl_base64) or by the SDF terminator ('$$$$', molblock).
     * @param {object} opts rendering options
     * @returns {Promise<object>} a Promise that will resolve to an object
     * containing the mol pickle (and possibly other results depending on
     * the job type), or to null if the job is aborted before being submitted
     */
    requestMolPickle(divId, molDesc, scaffoldText, opts) {
        if (!molDesc) {
            return Promise.resolve({
                pickle: null,
                match: null,
                svg: null,
                hasOwnCoords: null,
                useMolBlockWedging: null,
            });
        }
        let type = JOB_TYPES.RDKIT_NATIVE_LAYOUT;
        if (scaffoldText) {
            type = JOB_TYPES.ALIGNED_LAYOUT;
        } else if (opts.RECOMPUTE2D) {
            type = JOB_TYPES.REBUILD_LAYOUT;
        }
        return this.submit({
            divId,
            type,
            molDesc,
            scaffoldText,
            opts,
        });
    },

    /**
     * Request SVG for a given divId.
     * @param {string} divId id of the div the molecule belongs to
     * @param {UInt8Array} molDesc molecule description as pickle
     * @param {object} opts rendering options
     * @returns {Promise<string>} a Promise that will resolve to an object containing
     * the SVG when the job is completed, or to null
     * if the job is aborted before being submitted
     */
    requestSvg(divId, molDesc, opts) {
        const type = JOB_TYPES.GENERATE_SVG;
        return this.submit({
            divId,
            type,
            molDesc,
            opts,
        });
    },

    /**
     * Request MCS for a given divId.
     * @param {string} divId id of the div the MCS belongs to
     * @param {string|Array<UInt8Array>} molDesc molecule description as:
     * 1. array of pickles
     * 2. string constituted by a pipe-separated list of SMILES/pkl_base64 or
     * '$$$$'-separated list of CTABs
     * @param {object|null} mcsParams optional MCS parameters
     * @returns {Promise<object|null>} a Promise that will resolve to a MCS result object,
     * or to null if the job is aborted before being submitted
     */
    async requestMcs(divId, molDesc, mcsParams) {
        const type = JOB_TYPES.GENERATE_MCS;
        const res = await this.submit({
            divId,
            type,
            molDesc,
            opts: { mcsParams },
        });
        return res ? res.mcsResult : null;
    },

    /**
     * Request molecule description for a given div.
     * @param {Element} div
     * @returns {string} molecule description (SMILES, molblock, pkl_base64)
     */
    getMol(div) {
        const attr = Utils.dataAttr(this.getDivAttrs().MOL);
        return Utils.decodeNewline(div.getAttribute(attr) || '');
    },

    /**
     * Increment the number of references to key by one
     * @param {string} key cache key
     */
    incRef(key) {
        const cachedEntry = this.userOptCache[key] || {
            refCount: 0,
        };
        ++cachedEntry.refCount;
        this.userOptCache[key] = cachedEntry;
    },

    /**
     * Decrement the number of references to key by one
     * When the number drops to zero, cached coordinates are deleted.
     * @param {string} key cache key
     */
    decRef(key) {
        const cachedEntry = this.userOptCache[key];
        if (cachedEntry) {
            if (cachedEntry.refCount) {
                --cachedEntry.refCount;
            }
            if (!cachedEntry.refCount) {
                delete cachedEntry.currentMol;
            }
        }
        this.updateUserOptCache(key);
    },

    /**
     * Get current molecule coordinates, match and useMolBlockWeging
     * flag for a given key.
     * @param {string} key cache key
     * @returns {object|null} { pickle, match } dictionary for current mol
     */
    getCurrentMol(key) {
        return this.userOptCache[key]?.currentMol || null;
    },

    /**
     * Clear cached coordinates and match associated to a given key.
     * @param {string} key cache key
     */
    clearCurrentMol(key) {
        const cachedEntry = this.userOptCache[key];
        if (cachedEntry) {
            cachedEntry.currentMol = null;
        }
    },

    /**
     * Set current molecule coordinates and match for a given key.
     * @param {string} key cache key
     * @param {Uint8Array} pickle molecule pickle
     * @param {string} match scaffold match
     * @param {boolean} useMolBlockWedging whether native molblock
     * wedging should be used to depict this molecule
     */
    setCurrentMol(key, { pickle, match, useMolBlockWedging }) {
        const cachedEntry = this.userOptCache[key];
        if (cachedEntry) {
            cachedEntry.currentMol = {
                pickle,
                match,
                useMolBlockWedging,
            };
        }
    },

    /**
     * Get scaffold description for a given div.
     * @param {Element} div
     * @returns {string} scaffold description (SMILES, molblock or pkl_base64).
     * Note that the description may include multiple scaffolds, either separated by
     * a pipe symbol ('|', SMILES and pkl_base64) or by the SDF terminator
     * ('$$$$', molblock)
     */
    getScaffold(div) {
        const attr = Utils.dataAttr(this.getDivAttrs().SCAFFOLD);
        return Utils.decodeNewline(div.getAttribute(attr) || '');
    },

    /**
     * Get related node HTML tag and content for a given div
     * as a key: value dictionary.
     * @param {Element} div
     * @returns {object} object containing HTML tag name and
     * content as a key: value dictionary
     */
    getRelatedNodes(div) {
        return Object.fromEntries(this.relatedNodes().map(
            (k) => [Utils.dashToCamelCase(k), div.getAttribute(Utils.dataAttr(k))]
        ));
    },

    /**
     * For a given div, get the object corresponding to
     * the content of an HTML tag encoded as JSON string.
     * @param {Element} div
     * @param {string}  opt HTML tag name
     * @returns {object} object parsed from a JSON string
     */
    getJsonOpt(div, opt) {
        let value = null;
        const attr = Utils.dataAttr(opt);
        if (div.hasAttribute(attr)) {
            value = div.getAttribute(attr);
            try {
                value = JSON.parse(value);
            } catch (e) {
                value = null;
            }
        }
        return value;
    },

    /**
     * For a given div or divId, get the get_mol options for the molecule
     * encoded as a JSON string. The get_mol options which are not defined
     * in the div are replaced by default values.
     * @param {Element|string} div div or divId
     * @returns {object} get_mol options as a key: value dictionary
     */
    getMolOpts(div) {
        const res = { ...this.getDefaultMolOpts() };
        if (typeof div === 'object') {
            Object.assign(res, this.getJsonOpt(div, this.getDivAttrs().MOL_OPTS) || {});
        }
        return res;
    },

    /**
     * For a given div or divId, get the get_mol options for the scaffold
     * encoded as a JSON string. The get_mol options which are not defined
     * in the div are replaced by default values.
     * @param {Element|string} div div or divId
     * @returns {object} get_mol options as a key: value dictionary
     */
    getScaffoldOpts(div) {
        const res = { ...this.getDefaultScaffoldOpts() };
        if (typeof div === 'object') {
            Object.assign(res, this.getJsonOpt(div, this.getDivAttrs().SCAFFOLD_OPTS) || {});
        }
        return res;
    },

    /**
     * For a given div or divId, get the draw options encoded as
     * a JSON string. The draw options which are not defined
     * in the div are replaced by default values.
     * @param {Element|string} div div or divId
     * @returns {object} draw options as a key: value dictionary
     */
    getDrawOpts(div) {
        const res = { ...this.getDefaultDrawOpts() };
        if (typeof div === 'object') {
            Object.assign(res, this.getJsonOpt(div, this.getDivAttrs().DRAW_OPTS) || {});
        }
        return res;
    },

    /**
     * Write the 2D layout for molecule mol to the HTML Element
     * molDraw (either canvas or SVG div) using drawing options
     * specified in drawOpts. In case of failure it will try
     * again with kekulization switched off before giving up.
     * @param {JSMol|string} molIn RDKitJS molecule or SVG string
     * @param {object} drawOptsIn dictionary with drawing options
     * @param {Element} molDrawIn optional; HTML Element (either canvas or SVG div)
     * @@returns {string} result of the drawing call or null if failure
     */
    write2DLayout(molIn, drawOptsIn, molDrawIn) {
        const _write2DLayout = (mol, drawOpts, molDraw) => {
            let svg;
            if (typeof mol === 'object') {
                if (!mol) {
                    return null;
                }
                const drawOptsText = JSON.stringify(drawOpts);
                if (molDraw?.getContext) {
                    return mol.draw_to_canvas_with_highlights(molDraw, drawOptsText);
                }
                if (molDraw?.nodeName && molDraw.nodeName !== 'DIV') {
                    console.error(`write2DLayout: unsupported nodeName ${molDraw.nodeName}`);
                    return null;
                }
                svg = mol.get_svg_with_highlights(drawOptsText);
            } else if (typeof mol === 'string') {
                svg = mol;
            } else {
                console.error('write2DLayout: expected JSMol or SVG string');
                svg = '';
            }
            if (molDraw) {
                molDraw.innerHTML = svg;
            }
            return svg;
        };
        let res = null;
        try {
            res = _write2DLayout(molIn, drawOptsIn, molDrawIn);
        } catch {
            try {
                res = _write2DLayout(molIn, { ...drawOptsIn, kekulize: false }, molDrawIn);
            } catch {
                // if we fail we draw nothing
            }
        }
        return res;
    },

    /**
     * Request mol pickle for a given divId.
     * @param {string} divId id of the div the molecule belongs to
     * @param {string} molText molecule description (SMILES, molblock or pkl_base64)
     * @param {string|null} scaffoldText scaffold description (SMILES, molblock or pkl_base64).
     * Note that the description may include multiple scaffolds, either separated by
     * a pipe symbol ('|', SMILES and pkl_base64) or by the SDF terminator ('$$$$', molblock).
     * @param {object} userOptsIn rendering options
     * @returns {Promise} a Promise that will resolve to an object
     * containing the mol pickle (and possibly other results depending on
     * the job type), or to null if the job is aborted before being submitted
     */
    async getPickledMolAndMatch(divId, molText, scaffoldText, userOptsIn) {
        const promArray = [];
        let res = null;
        // if the user wants to align to a scaffoldText or highlight
        // the scaffoldText, we need an aligned layout + matches
        const userOpts = userOptsIn || {};
        if (userOpts.SCAFFOLD_ALIGN || userOpts.SCAFFOLD_HIGHLIGHT) {
            const FORCE_RDKIT = (userOpts.SCAFFOLD_ALIGN ? userOpts.FORCE_RDKIT : true);
            promArray.push(this.requestMolPickle(divId, molText, scaffoldText, {
                ...userOpts,
                FORCE_RDKIT,
            }));
        }
        // if the user does not want to align to a scaffoldText, we
        // need an unaligned layout
        if (!userOpts.SCAFFOLD_ALIGN) {
            promArray.push(this.requestMolPickle(divId, molText, null, {
                ...userOpts,
                SCAFFOLD_ALIGN: false,
                SCAFFOLD_HIGHLIGHT: false
            }));
        }
        const resArray = await Promise.all(promArray);
        if (resArray.every((i) => i)) {
            // if a match was requested, it will be in the first Promise
            // otherwise it will be undefined
            const firstRes = resArray[0];
            const lastRes = resArray[resArray.length - 1];
            res = {
                match: firstRes.match,
                // hasOwnCoords, useMolBlockWedging and pickle
                // will always be from the last promise
                hasOwnCoords: lastRes.hasOwnCoords,
                useMolBlockWedging: lastRes.useMolBlockWedging,
                pickle: lastRes.pickle,
            };
        }
        return res;
    },

    /**
     * Override drawOpts where relevant, i.e. in relation to the
     * value of specific userOpts, match, width, height, scaleFac,
     * transparency.
     * @param {Object|null} drawOpts input drawing options
     * @param {Object|null} userOpts user rendering options
     * @param {Object|null} match match object
     * @param {number|null} width image width
     * @param {number|null} height image height
     * @param {boolean|null} transparent whether background should be transparent
     * @returns {object} overridden drawOpts
     */
    overrideDrawOpts({
        drawOpts, userOpts, match, width, height, transparent
    }) {
        userOpts = userOpts || {};
        width = width || DEFAULT_IMG_OPTS.width;
        height = height || DEFAULT_IMG_OPTS.height;
        match = match || {};
        if (typeof transparent === 'undefined') {
            transparent = !this.getIsLegacyBrowser();
        }
        const drawOptsOut = { ...this.getDefaultDrawOpts(), ...(drawOpts || {}) };
        if (typeof userOpts.USE_MOLBLOCK_WEDGING === 'boolean' && userOpts.USE_MOLBLOCK_WEDGING) {
            Object.assign(drawOptsOut, {
                useMolBlockWedging: true,
                wedgeBonds: false,
                addChiralHs: false,
            });
        }
        if (userOpts.SCAFFOLD_HIGHLIGHT && match) {
            Object.assign(drawOptsOut, match);
        } else {
            delete drawOptsOut.atoms;
            delete drawOptsOut.bonds;
        }
        drawOptsOut.addAtomIndices = userOpts.ATOM_IDX || false;
        drawOptsOut.width = width;
        drawOptsOut.height = height;
        if (!drawOptsOut.backgroundColour) {
            drawOptsOut.backgroundColour = [1, 1, 1, 1];
        }
        if (transparent) {
            drawOptsOut.backgroundColour[3] = 0;
        }
        return drawOptsOut;
    },

    /**
     * Update the molecule visualized in div.
     * A spinning wheel is displayed until the new layout
     * is ready.
     * @param {Element} div
     * @param {bool} returnMolBlock if true returns the drawn
     * molecule as molblock
     * @returns {Promise} a promise that resolves to null
     * if the jobs was aborted, to a molblock if returnMolBlock === true,
     * and to '' otherwise.
     */
    async draw(div, returnMolBlock) {
        // if the div has 0 size, do nothing, as it may have
        // already been unmounted
        const { width, height } = this.getRoundedDivSize(div);
        const transparent = false;
        // get a spinner wheel with a radius appropriate
        // to the size of div
        const spinner = this.getSpinner(div);
        let molblock = '';
        const _asyncDraw = async (tid) => {
            // get the HTML element where we are going to draw
            const molDraw = this.getMolDraw(div);
            const userOpts = this.getUserOptsForDiv(div);
            const molOpts = this.getMolOpts(div);
            const scaffoldOpts = this.getScaffoldOpts(div);
            let drawOpts = this.getDrawOpts(div);
            const key = this.getCacheKey(div);
            let res = this.getCurrentMol(key);
            const scaffoldText = this.getScaffold(div);
            const divId = this.getDivId(div);
            if (!res) {
                const molText = this.getMol(div);
                drawOpts = this.overrideDrawOpts({
                    drawOpts, userOpts, width, height, transparent
                });
                res = await this.getPickledMolAndMatch(
                    divId, molText, scaffoldText, {
                        drawOpts, molOpts, scaffoldOpts, ...userOpts
                    }) || {};
            }
            const {
                pickle, match, hasOwnCoords, useMolBlockWedging
            } = res;
            userOpts.USE_MOLBLOCK_WEDGING = useMolBlockWedging || false;
            if (pickle) {
                this.setCurrentMol(key, { pickle, match, useMolBlockWedging });
                if (userOpts.SCAFFOLD_ALIGN || userOpts.SCAFFOLD_HIGHLIGHT) {
                    if (!match && scaffoldText) {
                        this.setFailsMatch(key, scaffoldText);
                    } else {
                        this.clearFailsMatch(key);
                    }
                }
                if (hasOwnCoords) {
                    this.setHasOwnCoords(key);
                } else {
                    this.clearHasOwnCoords(key);
                }
                drawOpts = this.overrideDrawOpts({
                    drawOpts, userOpts, match, width, height, transparent
                });
                const useSvg = (molDraw?.nodeName === 'DIV');
                if (useSvg) {
                    const svgRes = await this.requestSvg(divId, pickle, { drawOpts, ...userOpts });
                    if (svgRes?.svg) {
                        this.write2DLayout(svgRes.svg, drawOpts, molDraw);
                    }
                }
                if (!useSvg || returnMolBlock) {
                    const mol = await this.getMolFromPickle(pickle);
                    if (mol) {
                        try {
                            if (returnMolBlock) {
                                const molBlockParams = this.getMolblockParams(useMolBlockWedging);
                                molblock = Utils.getMolblockFromMol(mol, molBlockParams);
                            }
                            if (!useSvg) {
                                if (userOpts.ABBREVIATE) {
                                    mol.condense_abbreviations();
                                }
                                this.write2DLayout(mol, drawOpts, molDraw);
                            }
                        } catch (e) {
                            console.error('Failed to draw to div');
                        } finally {
                            mol.delete();
                        }
                    }
                }
            }
            const currentDiv = this.currentDivs().get(divId) || {};
            if (!currentDiv.childQueue) {
                spinner.style.display = 'none';
            }
            if (tid) {
                clearTimeout(tid);
            }
            return molblock;
        };
        const tid = setTimeout(() => {
            spinner.style.display = 'block';
        }, this.getWhlOpts().TIMEOUT);
        return _asyncDraw(tid);
    },

    /**
     * Called when the copy or cog buttons are clicked.
     * @param {Event} e the click event
     * @param {string} type either 'copy' or 'cog'
     * @param {Element} div
     * @returns {function} either the copyAction or cogAction function
     */
    onButtonAction(e, type, div) {
        e.stopPropagation();
        return this[`${type}Action`](div);
    },

    /**
     * Put content on the clipboard.
     * @param {object} content key: value dictionary containing
     * data (value) for each MIME type (key)
     * @returns {boolean} true if copy to clipboard succeeded, false
     * if it failed
     */
    async putClipboardContent(content) {
        // eslint-disable-next-line no-undef
        const item = new ClipboardItem(content);
        let res;
        try {
            await navigator.clipboard.write([item]);
            res = true;
        } catch (e) {
            console.error('%O', e);
            this.logClipboardError('Failed to write content');
            res = false;
        }
        return res;
    },

    /**
     * Returns a { molblock, smiles, inchi } dictionary
     * containing the respective chemical representations
     * associated to a given mol pickle.
     * @param {UInt8Array} pickle
     * @param {Array} formatsIn optional, array with formats that
     * should be retrieved ('molblock', 'smiles', 'inchi')
     * @param {object} userOpts user rendering options
     * @returns {object} dictionary with chemical representations
     */
    async getChemFormatsFromPickle(pickle, formatsIn, userOpts) {
        const formats = Array.isArray(formatsIn)
            ? [...formatsIn] : ['molblock', 'smiles', 'inchi'];
        const res = Object.fromEntries(formats.map((k) => [k, '']));
        const mol = await this.getMolFromPickle(pickle);
        if (mol) {
            const useMolBlockWedging = this.shouldUseMolBlockWedging(mol, userOpts);
            const molBlockParams = this.getMolblockParams(useMolBlockWedging);
            if (res.molblock === '') {
                res.molblock = Utils.getMolblockFromMol(mol, molBlockParams);
            }
            if (res.smiles === '' || res.inchi === '') {
                mol.remove_hs_in_place();
            }
            if (res.smiles === '') {
                try {
                    res.smiles = mol.get_smiles();
                } catch (e) {
                    console.error(`Failed to generate SMILES (${e})`);
                }
            }
            if (res.inchi === '') {
                try {
                    res.inchi = mol.get_inchi();
                } catch (e) {
                    console.error(`Failed to generate InChI (${e})`);
                }
            }
            mol.delete();
        }
        return res;
    },

    /**
     * Returns a JSMol from the passed pickle
     * IMPORTANT: it is responsibility of the caller to call
     * delete() on the returned JSMol when done with it to
     * avoid leaking memory, as the garbage collector will NOT
     * automatically free memory allocated by the WASM library.
     * @param {UInt8Array} pickle
     * @returns {JSMol|null} RDKitJS molecule
     */
    async getMolFromPickle(pickle) {
        // block until rdkitModule is ready
        const rdkitModule = await this.getRDKitModule();
        return Utils.getMolFromUInt8Array(rdkitModule, pickle);
    },

    /**
     * Returns a dictionary with the molecule, scaffold
     * match (if any) and useMolBlockWedging flag
     * associated to the passed key.
     * IMPORTANT: it is responsibility of the caller to call
     * delete() on the returned JSMol when done with it to
     * avoid leaking memory, as the garbage collector will NOT
     * automatically free memory allocated by the WASM library.
     * @param {string} key cache key
     * @returns {object|null} { mol: JSMol, match: object } dictionary
     */
    async getMolAndMatchForKey(key) {
        const currentMol = this.getCurrentMol(key);
        let res = null;
        if (currentMol) {
            const { pickle, match, useMolBlockWedging } = currentMol;
            res = {
                mol: await this.getMolFromPickle(pickle),
                match,
                useMolBlockWedging,
            };
        }
        return res;
    },

    /**
     * Returns the first divId (if there are multiple) associated
     * to the passed key. If the passed key is actually corresponding
     * to a divId, it will be returned unchanged.
     * @param {string} divIdOrKey cache key or divId
     * @returns {string} divId
     */
    getFirstDivIdFromDivIdOrKey(divIdOrKey) {
        let firstDivId = this.currentDivs().has(divIdOrKey) ? divIdOrKey : null;
        if (!firstDivId) {
            // note that an id may correspond to multiple divIds.
            // we will pick the first that matches our id
            Array.from(this.currentDivs().keys()).every((divId) => {
                if (divId.endsWith(this.getDivIdSeparator() + divIdOrKey)) {
                    firstDivId = divId;
                    return false;
                }
                return true;
            });
        }
        return firstDivId;
    },

    /**
     * Returns the array of all divIds (if there are multiple) associated
     * to the passed key. If the passed key is actually corresponding
     * to a divId, a single-element array with the passed divId will be
     * returned.
     * @param {string} divIdOrKey cache key or divId
     * @returns {Array<string>} array of divIds
     */
    getDivIdArrayFromDivIdOrKey(divIdOrKey) {
        let divIdArray = this.currentDivs().has(divIdOrKey) ? [divIdOrKey] : null;
        if (!divIdArray) {
            divIdArray = Array.from(this.currentDivs().keys()).filter(
                (divId) => divId.endsWith(this.getDivIdSeparator() + divIdOrKey)
            );
        }
        return divIdArray;
    },

    /**
     * Get an image with the 2D structure associated to the passed divId.
     * If a key is passed, the image from the first divId associated to
     * that key is returned.
     * @param {string} divIdOrKey cache key or divId
     * @param {object} opts optional dictionary with drawing options;
     * see getImageFromMol for details
     * @returns {string|Blob} a string if format is 'svg' or a Blob if 'png'
     */
    async getImageFromDivIdOrKey(divIdOrKey, opts) {
        let res = null;
        const divId = this.getFirstDivIdFromDivIdOrKey(divIdOrKey) || divIdOrKey;
        const key = this.getCacheKey(divId);
        const { mol, match, useMolBlockWedging } = await this.getMolAndMatchForKey(key) || {};
        if (mol) {
            try {
                const optsCopy = { ...opts };
                optsCopy.match = optsCopy.match || match;
                const div = this.getMolDiv(divId);
                const userOpts = this.getUserOptsForDiv(div || divId) || {};
                userOpts.USE_MOLBLOCK_WEDGING = useMolBlockWedging
                    && this.shouldUseMolBlockWedging(mol, userOpts);
                const drawOpts = this.getDrawOpts(div || divId);
                optsCopy.userOpts = { ...userOpts, ...optsCopy.userOpts };
                optsCopy.drawOpts = { ...drawOpts, ...optsCopy.drawOpts };
                res = this.getImageFromMol(mol, optsCopy);
            } catch (e) {
                console.error(`Failed to get image for ${divId} (${e})`);
            } finally {
                mol.delete();
            }
        }
        return res;
    },

    /**
     * Return the scaled blob.
     * If scaleFac is null or 1, the input blob is returned unchanged.
     * @param {Blob} blob input blob
     * @param {number} scaleFac (can be null)
     * @returns Promise that resolves to scaled blob
     */
    scaleBlob(blob, scaleFac) {
        if (typeof blob !== 'object' || !blob.arrayBuffer
            || typeof scaleFac !== 'number' || scaleFac <= 1) {
            return Promise.resolve(blob);
        }
        const dpi = NATIVE_CANVAS_RESOLUTION * scaleFac;
        return changeDpiBlob(blob, dpi);
    },

    /**
     * Dumps the canvas content to a base64-encoded PNG string.
     * @param {Canvas|OffscreenCanvas} canvas
     * @param {number} scaleFac scaling factor (can be null)
     * @returns {Promise} promise that resolves to base64-encoded PNG
     * or null if error
     */
    async toDataURL(canvas, scaleFac) {
        const blob = await this.toBlob(canvas, scaleFac);
        if (!blob) {
            return Promise.resolve(null);
        }
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            const failedToDecode = () => {
                console.error('Failed to decode image blob to base64 dataURL');
                resolve(null);
            };
            reader.onerror = failedToDecode;
            reader.onabort = failedToDecode;
            reader.readAsDataURL(blob);
        });
    },

    /**
     * Dumps the canvas content to a PNG Blob.
     * @param {Canvas|OffscreenCanvas} canvas
     * @param {number} scaleFac scaling factor (can be null)
     * @returns {Promise} Promise that resolves to PNG Blob
     */
    toBlob(canvas, scaleFac) {
        if (typeof canvas.toBlob === 'function') {
            return new Promise((resolve) => {
                canvas.toBlob((img) => {
                    resolve(this.scaleBlob(img, scaleFac));
                });
            });
        }
        if (typeof canvas.convertToBlob === 'function') {
            return canvas.convertToBlob().then((img) => this.scaleBlob(img, scaleFac));
        }
        return null;
    },

    /**
     * Get an image with the 2D structure associated to the passed JSMol.
     * If opts.format is an array of formats, a dictionary object
     * { format: image } is returned.
     * @param {JSMol} mol RDKitJS molecule
     * @param {object} opts optional dictionary with drawing options:
     * - format: can either be a single string or an array of strings.
     *   Supported formats are 'png', 'base64png' or 'svg'; defaults to 'png'.
     * - transparent: transparent background, defaults to true
     * - width: image width, defaults to the current div width (if any)
     * - height: image height, defaults to the current div height (if any)
     * - scaleFac: image scale factor, defaults to the current scale factor
     * - match: match object, defaults to the current div match
     * - userOpts: user settings, defaults to the current div settings
     * - drawOpts: RDKit drawOpts, defaults to the current div drawOpts
     * @returns {string|Blob|object} if opts.format is a string, the return type
     * is a string if format is either 'svg' or 'base64png', otherwise a Blob.
     * If opts.format is an array of format string, the return type is an object
     * relating format string to the respective image.
     */
    async getImageFromMol(mol, opts) {
        if (!mol) {
            return null;
        }
        const { format, userOpts } = opts;
        let shouldReturnObject = false;
        const imageDict = {};
        let formatArray;
        if (Array.isArray(format)) {
            shouldReturnObject = true;
            formatArray = format;
        } else {
            formatArray = [format || 'png'];
        }
        if (userOpts?.ABBREVIATE) {
            mol.condense_abbreviations();
        }
        const scaleFac = opts.scaleFac || 1;
        const drawOpts = this.overrideDrawOpts(opts);
        if (formatArray.includes('svg')) {
            try {
                imageDict.svg = this.write2DLayout(mol, drawOpts);
            } catch (e) {
                console.error(`Failed to generate SVG image (${e})`);
            }
        } else {
            let canvas;
            if (haveWindow) {
                canvas = document.createElement('canvas');
            } else if (typeof OffscreenCanvas !== 'undefined') {
                canvas = new OffscreenCanvas(drawOpts.width, drawOpts.height);
            } else {
                console.error('Canvas is not available on this platform');
            }
            if (canvas) {
                try {
                    this.resizeMolDraw(canvas, drawOpts.width, drawOpts.height, scaleFac);
                    if (this.write2DLayout(mol, drawOpts, canvas) !== null) {
                        if (formatArray.includes('base64png')) {
                            imageDict.base64png = await this.toDataURL(canvas, scaleFac);
                            if (!imageDict.base64png) {
                                console.error('Failed to generate base64-encoded PNG image');
                            }
                        }
                        if (formatArray.includes('png')) {
                            imageDict.png = await this.toBlob(canvas, scaleFac);
                            if (!imageDict.png) {
                                console.error('Failed to generate binary PNG image');
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Failed to draw to canvas (${e})`);
                }
            }
        }
        return shouldReturnObject ? imageDict : imageDict[formatArray[0]];
    },

    /**
     * Write the 2D structure associated to the passed molText to an HTML5 canvas.
     * @param {string} molText molecule description (SMILES, molblock or pkl_base64)
     * @param {string|null} scaffoldText scaffold description (SMILES, molblock or pkl_base64).
     * Note that the description may include multiple scaffolds, either separated by
     * a pipe symbol ('|', SMILES and pkl_base64) or by the SDF terminator ('$$$$', molblock).
     * @param {object} opts optional dictionary with drawing options:
     * - transparent: transparent background, defaults to true
     * - width: image width, defaults to the current div width (if any)
     * - height: image height, defaults to the current div height (if any)
     * - scaleFac: image scale factor, defaults to the current scale factor
     * - match: match object, defaults to the current div match
     * - userOpts: user settings, defaults to the current div settings
     * - molOpts: RDKit get_mol opts, defaults to the current div settings
     * - drawOpts: RDKit drawOpts, defaults to the current div drawOpts
     * @returns {boolean} true if success, false if failure
     */
    async molTextToCanvas(molText, scaffoldText, opts, canvas) {
        const uniqueId = uuidv4();
        let { userOpts, molOpts, scaffoldOpts } = opts;
        userOpts = userOpts || {};
        molOpts = molOpts || {};
        scaffoldOpts = scaffoldOpts || {};
        const res = await this.getPickledMolAndMatch(
            uniqueId, molText, scaffoldText, {
                ...userOpts, molOpts, scaffoldOpts
            }) || {};
        const { pickle, match, useMolBlockWedging } = res;
        if (pickle) {
            userOpts.USE_MOLBLOCK_WEDGING = useMolBlockWedging || false;
            Object.assign(opts, { userOpts, match });
            const mol = await this.getMolFromPickle(pickle);
            if (mol) {
                try {
                    const drawOpts = this.overrideDrawOpts(opts);
                    this.resizeMolDraw(canvas, drawOpts.width, drawOpts.height, opts.scaleFac);
                    return !!this.write2DLayout(mol, drawOpts, canvas);
                } finally {
                    mol.delete();
                }
            }
        }
        return false;
    },

    /**
     * Get an image with the 2D structure associated to the passed molText.
     * @param {string} molText molecule description (SMILES, molblock or pkl_base64)
     * @param {string|null} scaffoldText scaffold description (SMILES, molblock or pkl_base64).
     * Note that the description may include multiple scaffolds, either separated by
     * a pipe symbol ('|', SMILES and pkl_base64) or by the SDF terminator ('$$$$', molblock).
     * @param {object} opts optional dictionary with drawing options:
     * - format: 'png', 'base64png' or 'svg', defaults to 'png'
     * - transparent: transparent background, defaults to true
     * - width: image width, defaults to the current div width (if any)
     * - height: image height, defaults to the current div height (if any)
     * - scaleFac: image scale factor, defaults to the current scale factor
     * - match: match object, defaults to the current div match
     * - userOpts: user settings, defaults to the current div settings
     * - drawOpts: RDKit drawOpts, defaults to the current div drawOpts
     * @returns {string|Blob} a string if format is either 'svg' or 'base64png',
     * otherwise a Blob
     */
    async getImageFromMolText(molText, scaffoldText, opts) {
        const uniqueId = uuidv4();
        let { userOpts, molOpts, scaffoldOpts } = opts;
        userOpts = userOpts || {};
        molOpts = molOpts || {};
        scaffoldOpts = scaffoldOpts || {};
        const res = await this.getPickledMolAndMatch(
            uniqueId, molText, scaffoldText, {
                ...userOpts, molOpts, scaffoldOpts
            }) || {};
        const { pickle, match, useMolBlockWedging } = res;
        if (!pickle) {
            return null;
        }
        userOpts.USE_MOLBLOCK_WEDGING = useMolBlockWedging || false;
        Object.assign(opts, { userOpts, match });
        let image = null;
        if (opts.format === 'svg') {
            const drawOpts = this.overrideDrawOpts(opts);
            const svgRes = await this.requestSvg(uniqueId, pickle, { drawOpts, ...userOpts, molOpts });
            image = svgRes?.svg;
        } else {
            const mol = await this.getMolFromPickle(pickle);
            image = await this.getImageFromMol(mol, opts);
        }
        return image;
    },

    /**
     * Return whether useMolBlockWedging should be set to true or not
     * based on desired user visualization options and the presence
     * of coordinates on the molecule.
     * @param {JSMol} mol RDKitJS molecule
     * @param {object} userOpts user rendering options
     * @returns {boolean} whether useMolBlockWedging should be set to true
     */
    shouldUseMolBlockWedging: (mol, userOpts) => {
        if (mol.has_coords() !== 2 || userOpts.RECOMPUTE2D) {
            return false;
        }
        let shouldUse = userOpts.USE_MOLBLOCK_WEDGING;
        if (typeof shouldUse !== 'boolean') {
            shouldUse = true;
        }
        return shouldUse;
    },

    /**
     * Generate appropriate JSON parameters for get_molblock()
     * based on the value of the useMolBlockWedging parameter.
     * @param {string|boolean} useMolBlockWedging can be a boolean or 'a'
     * @returns {string} get_molblock parameters as JSON string
     */
    getMolblockParams(useMolBlockWedgingIn) {
        const useMolBlockWedging = (typeof useMolBlockWedgingIn === 'boolean'
            ? useMolBlockWedgingIn : true);
        const addChiralHs = !useMolBlockWedging;
        return JSON.stringify({ useMolBlockWedging, addChiralHs });
    },

    /**
     * Prefix an image with MIME type for being put to clipboard as HTML.
     * Unrecognized types are returned unchanged.
     * @param {string} image string image description
     * @param {string} format image format (currently, base64png only)
     * @param {string} molBlock molBlock (can be null)
     * @param {number} width image width (can be null)
     * @param {number} height image height (can be null)
     * @returns {string} image formatted for clipboard
     */
    formatImageTextHtml(image, format, { molBlock, width, height }) {
        const size = (width && height ? ` width="${width}px" height="${height}px"` : '');
        const isSvg = (format === 'svg');
        if (isSvg || format === 'base64png') {
            const srcImage = (isSvg ? `data:image/svg+xml,${encodeURIComponent(image)}` : image);
            return `<img alt="${molBlock || ''}" src="${srcImage}"${size}>`;
        }
        return image;
    },

    /**
     * Put some content from a given div on the clipboard.
     * @param {Element} div
     * @param {Array<string>} formats array of formats
     * to be copied to clipboard ('png', 'svg', 'molblock', 'base64png')
     */
    async putClipboardItem(div, formats) {
        let molMatchWedging = {};
        this.setButtonsEnabled(div, false);
        try {
            const drawOpts = this.getDrawOpts(div);
            const userOpts = this.getUserOptsForDiv(div);
            const key = this.getCacheKey(div);
            molMatchWedging = await this.getMolAndMatchForKey(key) || {};
            const { mol, match, useMolBlockWedging } = molMatchWedging;
            if (!mol) {
                this.logClipboardError();
            } else {
                const content = {};
                const clipboardDict = {};
                const formatSet = new Set();
                let molblockToClipboard = false;
                // svg, base64png and molblock are all text/plain, so we can't have all
                // priority is svg > base64png > molblock
                let plainTextIdx = -1;
                ['svg', 'base64png', 'molblock'].every((fmt) => {
                    plainTextIdx = formats.indexOf(fmt);
                    return plainTextIdx === -1;
                });
                let needMolBlock = formats.includes('molblock');
                if (formats.includes('png')) {
                    formatSet.add('png');
                    formatSet.add('base64png');
                    needMolBlock = true;
                }
                let molBlock;
                if (needMolBlock) {
                    userOpts.USE_MOLBLOCK_WEDGING = useMolBlockWedging
                        && this.shouldUseMolBlockWedging(mol, userOpts);
                    const molBlockParams = this.getMolblockParams(userOpts.USE_MOLBLOCK_WEDGING);
                    molBlock = Utils.getMolblockFromMol(mol, molBlockParams);
                }
                const textFormat = (plainTextIdx !== -1 ? formats[plainTextIdx] : null);
                if (textFormat) {
                    if (textFormat === 'molblock') {
                        clipboardDict[textFormat] = molBlock;
                        molblockToClipboard = true;
                    } else {
                        formatSet.add(textFormat);
                    }
                }
                const format = Array.from(formatSet);
                const { width, height } = this.getRoundedDivSize(div);
                const scaleFac = this.copyImgScaleFac;
                const opts = {
                    width,
                    height,
                    match,
                    format,
                    scaleFac,
                    drawOpts,
                    userOpts,
                };
                Object.assign(clipboardDict, await this.getImageFromMol(mol, opts));
                let msg = '';
                Object.entries(clipboardDict).forEach(([fmt, image]) => {
                    if (image) {
                        const isBinaryImage = (typeof image !== 'string');
                        if (!isBinaryImage && !(fmt === 'base64png' && molblockToClipboard)) {
                            const type = 'text/plain';
                            const imageForClipboard = this.formatImageTextHtml(
                                image, fmt, { width, height });
                            content[type] = Promise.resolve(new Blob([imageForClipboard], { type }));
                        } else if (isBinaryImage) {
                            const type = 'image/png';
                            const imageForClipboard = image;
                            content[type] = Promise.resolve(new Blob([imageForClipboard], { type }));
                        }
                        if (fmt === 'base64png') {
                            const type = 'text/html';
                            const imageForClipboard = this.formatImageTextHtml(
                                image, fmt, { molBlock, width, height });
                            content[type] = Promise.resolve(new Blob([imageForClipboard], { type }));
                        }
                    } else {
                        msg += `Failed to generate ${fmt} image`;
                    }
                });
                if (msg) {
                    this.logClipboardError(msg);
                }
                if (Object.keys(content).length) {
                    await this.putClipboardContent(content);
                }
            }
        } catch (e) {
            this.logClipboardError(`${e}`);
        } finally {
            if (molMatchWedging.mol) {
                molMatchWedging.mol.delete();
            }
            this.setButtonsEnabled(div, true);
        }
    },

    /**
     * Called when the copy button on a given div is clicked.
     * @param {Element} div
     */
    async copyAction(div) {
        if (await this.canAccessClipboard()) {
            await this.putClipboardItem(div, ['png', 'molblock']);
        }
    },

    /**
     * Called when the cog button on a given div is clicked.
     * @param {Element} div
     */
    async cogAction(div) {
        if (!this.settings) {
            this.settings = this.createSettingsDialog();
        }
        this.showOrHideSettings(div);
    },

    /**
     * Show the settings dialog.
     * Override to carry out specific actions before/after.
     */
    showSettings() {
        const tooltip = this.getTooltip('cog');
        if (tooltip && tooltip.isVisible()) {
            tooltip.hide();
        }
        this.settings.show();
    },

    /**
     * Hide the settings dialog.
     * Override to carry out specific actions before/after.
     */
    hideSettings() {
        this.settings.hide();
    },

    /**
     * Toggles the SettingsDialog visibility status
     * when cog button on a given div is clicked.
     * @param {Element} div
     */
    showOrHideSettings(div) {
        const divId = this.getDivId(div);
        // if the SettingsDialog was visible and the user clicked
        // on the cog where the SettingsDialog currently is, hide it
        // otherwise show it on div
        if (this.settings.isVisible && divId === this.settings.currentDivId) {
            this.hideSettings();
        } else {
            this.settings.setMolDiv(div);
            this.showSettings();
        }
    },

    /**
     * Creates a button Element of the desired type
     * if it does not yet exist and returns a copy.
     * @param {string} type either 'copy' or 'cog'
     * @returns {Element} HTML button element
     */
    createButton(type) {
        this.buttons = this.buttons || {};
        if (!this.buttons[type]) {
            const div = document.createElement('div');
            div.className = 'button-container';
            const button = document.createElement('button');
            button.className = `button ${type}`;
            button.name = `${type}-button`;
            button.type = 'button';
            const icon = this.getButtonIcon(type);
            button.appendChild(icon);
            div.appendChild(button);
            this.buttons[type] = div;
        }
        return this.buttons[type].cloneNode(true);
    },

    /**
     * Sets the radius of the spinning wheel based on the size
     * of the outer container.
     * @param {Element} spinner spinner div
     * @param {number} containerHeight height of the container (px)
     * @param {number} containerWidth width of the container (px)
     */
    setSpinnerWhlRadius(spinner, containerHeight, containerWidth) {
        const whlRadius = Math.round(containerHeight * this.getWhlOpts().SCALE);
        let marginTop = Math.round(0.5 * (containerHeight - whlRadius)) - this.getWhlOpts().WIDTH;
        marginTop = `margin-top: ${marginTop}px; `;
        let marginLeft = '';
        if (containerWidth) {
            marginLeft = Math.round(0.5 * (containerWidth - whlRadius)) - this.getWhlOpts().WIDTH;
            marginLeft = `margin-left: ${marginLeft}px; `;
        }
        const style = `${marginTop}${marginLeft}width: ${whlRadius}px; `
            + `height: ${whlRadius}px; border-width: ${this.getWhlOpts().WIDTH}px`;
        spinner.firstChild.setAttribute('style', style);
    },

    /**
     * Creates a new spinner if it does not yet exist and returns a copy
     * of the spinner with a radius appropriate to the container div.
     * @param {Element} div container div
     * @returns {Element} spinner div
     */
    createSpinner(div) {
        if (!this._spinner) {
            const spinner = document.createElement('div');
            spinner.className = `${this.getRdkStrRnrPrefix()}spinner`;
            const spinnerWhl = document.createElement('div');
            spinnerWhl.className = 'whl';
            spinner.appendChild(spinnerWhl);
            this._spinner = spinner;
        }
        const spinner = this._spinner.cloneNode(true);
        const { height } = this.getRoundedDivSize(div);
        this.setSpinnerWhlRadius(spinner, height);
        return spinner;
    },

    /**
     * Adds a spinner to a given div and returns the spinner.
     * @param {Element} div container div
     * @returns {Element} spinner div
     */
    getSpinner(div) {
        let spinner = div.getElementsByTagName('div');
        if (!spinner.length) {
            spinner = this.createSpinner(div);
            div.appendChild(spinner);
        } else {
            [spinner] = spinner;
        }
        return spinner;
    },

    /**
     * Returns a dictionary with width and height
     * associated to the passed div as rounded integers.
     * If the data-width and data-height attributes are not present or 0,
     * the current div rect width and height are returned.
     * If also the current div rect width or height are zero, a default
     * value will be used.
     * @param {Element} div
     * @returns {object} { width: integer, height: integer } dictionary
     */
    getRoundedDivSize(div) {
        const divRect = div.getBoundingClientRect();
        const width = parseInt(div.getAttribute(Utils.dataAttr(this.getDivAttrs().WIDTH)) || '0', 10)
            || Math.round(divRect.width) || DEFAULT_IMG_OPTS.width;
        const height = parseInt(div.getAttribute(Utils.dataAttr(this.getDivAttrs().HEIGHT)) || '0', 10)
            || Math.round(divRect.height) || DEFAULT_IMG_OPTS.height;
        return { width, height };
    },

    /**
     * Resize the passed molDraw HTML Element to the passed width and height.
     * @param {Element} molDraw HTML Element (either canvas or SVG div)
     * @returns {object} { width: integer, height: integer } dictionary
     */
    resizeMolDraw(molDraw, width, height, scaleFac) {
        const scale = scaleFac || _window.devicePixelRatio;
        if (!(width > 0 && height > 0)) {
            return;
        }
        if (molDraw.getContext || molDraw.nodeName === 'CANVAS') {
            molDraw.width = width * scale;
            molDraw.height = height * scale;
            const ctx = molDraw.getContext('2d');
            if (ctx) {
                ctx.scale(scale, scale);
            }
        }
        if (molDraw.setAttribute) {
            molDraw.style.width = `${width}px`;
            molDraw.style.height = `${height}px;`;
        }
    },

    /**
     * Creates an SVG div if it does not yet exist and
     * returns a copy of size appropriate to the container div.
     * @param {Element} div container div
     * @returns {Element} SVG div
     */
    createSvgDiv(div) {
        if (!this._svgDiv) {
            const svgDiv = document.createElement('div');
            svgDiv.setAttribute('name', 'mol-draw');
            svgDiv.className = `${this.getRdkStrRnrPrefix()}mol-draw`;
            svgDiv.appendChild(document.createTextNode(' '));
            this._svgDiv = svgDiv;
        }
        const svgDiv = this._svgDiv.cloneNode(true);
        const { width, height } = this.getRoundedDivSize(div);
        this.resizeMolDraw(svgDiv, width, height);
        return svgDiv;
    },

    /**
     * Creates a canvas element if it does not yet exist and
     * returns a copy of size appropriate to the container div.
     * @param {Element} div container div
     * @returns {Element} canvas
     */
    createCanvas(div) {
        if (!this._canvas) {
            const canvas = document.createElement('canvas');
            canvas.setAttribute('name', 'mol-draw');
            this._canvas = canvas;
        }
        const canvas = this._canvas.cloneNode(true);
        const { width, height } = this.getRoundedDivSize(div);
        this.resizeMolDraw(canvas, width, height);
        return canvas;
    },

    /**
     * Creates an array of HTML tag names (no data- prefix)
     * if it does not yet exist and returns it.
     * @returns {Array<string>} array of HTML attribute names
     */
    divTags() {
        if (!this._divTags) {
            this._divTags = Object.values(this.getDivAttrs());
        }
        return this._divTags;
    },

    /**
     * Creates an array of user-defined option names (no data- prefix)
     * if it does not yet exist and returns it.
     * @returns {Array<string>} array of user-defined option names
     */
    userTags() {
        if (!this._userTags) {
            this._userTags = Object.values(this.getAvailUserOpts()).map((i) => i.tag);
        }
        return this._userTags;
    },

    /**
     * Creates an array of all HTML tags (no data- prefix)
     * if it does not yet exist and returns it.
     * @returns {Array<string>} array of HTML tags
     */
    allTags() {
        if (!this._allTags) {
            this._allTags = this.divTags().concat(this.userTags());
        }
        return this._allTags;
    },

    /**
     * Update the cache of user-defined options for a given key.
     * If the value of the option is a boolean and is the same
     * as the default value for that option, the key for that option
     * is removed from the cache. If no keys are left, the whole entry
     * for that div is removed.
     * Note that the div is identified by a key computed by getCacheKey().
     * @param {string} key cache key
     * @param {string} userOpt name of the user-defined option
     * @param {boolean|string|null} value value to be stored
     */
    updateUserOptCache(key, userOpt, value) {
        const cachedEntry = this.userOptCache[key] || {};
        if (userOpt) {
            const isBool = (typeof value === 'boolean');
            const cachedValue = cachedEntry[userOpt];
            if (value !== null && (!isBool || typeof cachedValue === 'undefined')) {
                cachedEntry[userOpt] = value;
            } else if (value === null || (isBool && cachedValue !== value)) {
                delete cachedEntry[userOpt];
            }
        }
        if (Object.keys(cachedEntry).length) {
            this.userOptCache[key] = cachedEntry;
        } else {
            delete this.userOptCache[key];
        }
    },

    /**
     * Get the value of a user-defined boolean option from cache
     * for a given key.
     * If the cached value does not exist, returns undefined
     * @param {string} key cache key
     * @param {string} userOpt name of the user-defined option
     * @returns {boolean|string} cached value, or undefined if there
     * is no value associated to userOpt in the cache
     *
     */
    getCachedValue(key, userOpt) {
        const cachedEntry = this.userOptCache[key];
        let cachedValue;
        if (cachedEntry) {
            cachedValue = cachedEntry[userOpt];
        }
        return cachedValue;
    },

    /**
     * Get the value of a user-defined option from cache for a given div
     * or divId. If the value can be converted to a boolean, the value
     * is returned as a boolean, otherwise the value is returned as
     * a string. If no value is found, undefined is returned.
     * Note that the div is identified by a key computed by getCacheKey().
     * If no cached value exists, the value read from the div is returned.
     * If the div has no value, or a divId is passed, undefined is returned.
     * @param {Element|string} div div or divId
     * @param {string} tag name of the user-defined option
     * @returns {any} value if the value was found, undefined if the value
     * was not found
     */
    getDivOpt(div, tag) {
        const key = this.getCacheKey(div);
        let res = this.getCachedValue(key, tag);
        if (typeof res === 'undefined' && typeof div !== 'string') {
            res = div.getAttribute(Utils.dataAttr(tag));
        }
        return this.toBool(res);
    },

    /**
     * Convert HTML attribute to bool if possible.
     * @param {string|null} v HTML value obtained calling Element.getAttribute
     * @returns true or false if v can be converted to boolean, otherwise v
     * as a string, or undefined if v is null
     */
    toBool: (v) => {
        let res;
        if (typeof v === 'boolean') {
            return v;
        }
        if (typeof v === 'string') {
            const c = v.substring(0, 1).toLowerCase();
            if (c && 'fn'.includes(c)) {
                res = false;
            } else if (!c || 'ty'.includes(c)) {
                res = true;
            } else {
                res = v;
            }
        }
        return res;
    },

    /**
     * Returns true if the given key was previously found
     * not to match the given scaffold definition.
     * @param {stringh} key cache key
     * @param {string} scaffold scaffold definition (SMILES or CTAB)
     * @returns {boolean} true if the given key was previously
     * found not to match this scaffold, false if not
     */
    getFailsMatch(key, scaffold) {
        return (scaffold && this.getCachedValue(key, NO_MATCH) === scaffold);
    },

    /**
     * Mark the given key as failing to match the given
     * scaffold definition.
     * @param {string} key cache key
     * @param {string} scaffold scaffold definition (SMILES or CTAB)
     */
    setFailsMatch(key, scaffold) {
        this.updateUserOptCache(key, NO_MATCH, scaffold);
    },

    /**
     * Clear the 'fails scaffold match' flag on the given key.
     * @param {string} key cache key
     */
    clearFailsMatch(key) {
        this.updateUserOptCache(key, NO_MATCH, null);
    },

    /**
     * Returns true if the given key has its own set of coordinates.
     * @param {string} key cache key
     * @returns {boolean} true if the given key has
     * its own set of coordinates, false if not
     */
    getHasOwnCoords(key) {
        return this.getCachedValue(key, HAS_OWN_COORDS);
    },

    /**
     * Mark the given key as having its own set of coordinates.
     * @param {string} key cache key
     */
    setHasOwnCoords(key) {
        this.updateUserOptCache(key, HAS_OWN_COORDS, true);
    },

    /**
     * Clear the 'has own coords' flag on the given key.
     * @param {string} key cache key
     */
    clearHasOwnCoords(key) {
        this.updateUserOptCache(key, HAS_OWN_COORDS, null);
    },

    /**
     * Called when a div with given divId is removed from the DOM.
     * All jobs associated to that divId are aborted as their results
     * are not needed anymore, and any cached attributes associated
     * to that divId are also removed.
     * Note that this does not include the user-defined visualization
     * options that the user may have changed through SettingsDialog,
     * which are persisted in a different cache.
     * @param {Element} divId id of the div that has been removed
     */
    removeDiv(divId) {
        if (this.settings?.molDiv) {
            const molDivId = this.getDivId(this.settings.molDiv);
            if (divId === molDivId) {
                this.hideSettings();
            }
        }
        this.scheduler().mainQueue.abortJobs(divId);
        this.currentDivs().delete(divId);
        const key = this.getCacheKey(divId);
        this.decRef(key);
    },

    /**
     * Called to get the tooltip of the requested type.
     * If text is provided and the tooltip does not exist,
     * it will be created.
     * @param {string} type tooltip type ('copy' or 'cog')
     * @param {string} text tooltip text
     * @returns {object} ButtonTooltip instance
     */
    getTooltip(type, text) {
        if (!this._tooltips) {
            this._tooltips = {};
        }
        if (text && !this._tooltips[type]) {
            this._tooltips[type] = new ButtonTooltip(this, text);
        }
        return this._tooltips[type];
    },

    /**
     * Called to show/hide the button tooltip.
     * @param {string} type tooltip type ('copy' or 'cog')
     * @param {string} text tooltip text
     * @param {object} e event
     */
    showHideTooltip(e, type, text) {
        const tooltip = this.getTooltip(type, text);
        if (e.type === 'mouseleave' && tooltip.isVisible()) {
            tooltip.hide();
        } else if (e.type === 'mouseenter' && e.target.firstChild && !tooltip.isVisible()) {
            tooltip.show(e.target.firstChild);
        }
    },

    /**
     * Update the div with a given divId.
     * An optional callback can be passed which will be called
     * whenever the user changes visualization options:
     * userOptsCallback(divId, field, isChecked, molblock)
     * where:
     * - divId is the identifier of the div
     * - field is the name of the attribute changed by the user
     * - isChecked is the boolean value of the attribute
     * - molblock is the current set of coordinates
     * @param {string} divId
     * @param {function} userOptsCallback optional callback
     */
    updateMolDrawDiv(divId, userOptsCallback) {
        const div = this.getMolDiv(divId);
        if (!div) {
            return;
        }
        const key = this.getCacheKey(divId);
        this.setRendererCss();
        this.getSpinner(div);
        this.clearCurrentMol(key);
        const divAttrs = Object.fromEntries(this.allTags().map(
            (tag) => [tag, div.getAttribute(Utils.dataAttr(tag))]
        ));
        let molDraw = this.getMolDraw(div);
        const { width, height } = this.getRoundedDivSize(div);
        if (width > 0 && height > 0) {
            const { WIDTH, HEIGHT } = this.getDivAttrs();
            divAttrs[WIDTH] = width;
            divAttrs[HEIGHT] = height;
            if (molDraw) {
                this.resizeMolDraw(molDraw, width, height);
            }
        }
        divAttrs.userOptsCallback = userOptsCallback;
        this.currentDivs().set(divId, divAttrs);
        this.getButtonTypes().forEach(({ type, tooltip }) => {
            let button = this.getButton(div, type);
            const shouldHide = this.getIsLegacyBrowser() || this.toBool(divAttrs[`hide-${type}`]);
            if (!shouldHide && !button) {
                button = this.createButton(type);
                if (tooltip) {
                    button.onmouseenter = (e) => {
                        if (!(this.settings?.isVisible
                            && divId === this.settings.currentDivId
                            && e?.target?.firstChild?.className.includes('cog'))) {
                            this.showHideTooltip(e, type, tooltip);
                        }
                    };
                    button.onmouseleave = (e) => {
                        this.showHideTooltip(e, type, tooltip);
                    };
                }
                button.onclick = (e) => {
                    this.onButtonAction(e, type, div);
                    if (button.onmouseleave) {
                        button.onmouseleave(e);
                    }
                };
                div.insertBefore(button, molDraw);
            } else if (shouldHide && button) {
                button.remove();
            }
        });
        const useSvg = this.toBool(divAttrs[this.getDivAttrs().USE_SVG]);
        if (molDraw) {
            const isSvg = (molDraw.nodeName === 'DIV');
            if (isSvg ^ useSvg) {
                molDraw.remove();
                molDraw = null;
            }
        }
        if (!molDraw) {
            div.appendChild(useSvg ? this.createSvgDiv(div) : this.createCanvas(div));
            if (width && !div.style.width) {
                div.style.width = `${width}px`;
            }
            if (height && !div.style.height) {
                div.style.height = `${height}px`;
            }
        }
        this.draw(div);
        if (this.settings?.isVisible && divId === this.settings.currentDivId) {
            this.hideSettings();
        }
    },

    /**
     * For a given div, it will check if the div needs to be updated
     * @param {Element|string} divOrDivId div or divId
     * @returns {boolean} whether the div needs to be updated
     */
    shouldDraw(divOrDivId) {
        let shouldDraw = false;
        let div;
        let divId;
        if (typeof divOrDivId === 'object') {
            div = divOrDivId;
            divId = div.id;
        } else {
            divId = divOrDivId;
            div = this.getMolDiv(divId);
        }
        if (!div) {
            return shouldDraw;
        }
        let currentDivValue;
        if (!shouldDraw) {
            // if this divId has not been seen before, it needs to
            // be drawn
            currentDivValue = this.currentDivs().get(divId);
            if (!currentDivValue) {
                const key = this.getCacheKey(divId);
                this.incRef(key);
                shouldDraw = true;
            }
        }
        // if it was seen before, we may still need to redraw
        // if some attribute changed
        if (!shouldDraw) {
            const { width, height } = this.getRoundedDivSize(div);
            const areWidthHeightNonZero = (width > 0 && height > 0);
            const currentWidth = parseInt(currentDivValue.width || '0', 10);
            const currentHeight = parseInt(currentDivValue.height || '0', 10);
            if (!areWidthHeightNonZero || currentWidth !== width || currentHeight !== height) {
                shouldDraw = true;
                this.setSpinnerWhlRadius(this.getSpinner(div), height);
                this.getMolDraw(div).innerHTML = '';
            }
        }
        if (!shouldDraw) {
            const widthHeightTags = [this.getDivAttrs().WIDTH, this.getDivAttrs().HEIGHT];
            shouldDraw = this.allTags().some((tag) => {
                if (widthHeightTags.includes(tag)) {
                    return false;
                }
                const divAttrValue = div.getAttribute(Utils.dataAttr(tag));
                const currentDivAttrValue = currentDivValue[tag];
                return (typeof currentDivAttrValue !== 'undefined' && divAttrValue !== currentDivAttrValue);
            });
        }
        return shouldDraw;
    },

    /**
     * For a given div, it will check if the div needs to be updated
     * and will do so if needed.
     * @param {string} divId
     * @param {function} userOptsCallback optional callback
     * @returns {boolean} whether the div was updated
     */
    updateMolDrawDivIfNeeded(divId, userOptsCallback) {
        // if a redraw is needed, update
        const res = this.shouldDraw(divId);
        if (res) {
            this.updateMolDrawDiv(divId, userOptsCallback);
        }
        return res;
    },

    /**
     * Update any div whose attributes have changed.
     */
    updateMolDrawDivs(userOptsCallback) {
        const seenDivKeys = new Set();
        const divArray = this.getMolDivArray();
        divArray.forEach((div) => {
            const divId = this.getDivId(div);
            this.updateMolDrawDivIfNeeded(divId, userOptsCallback);
            seenDivKeys.add(divId);
        });
        // purge any div which is not mounted anymore from the cache
        this.currentDivs().forEach((v, k) => {
            if (!seenDivKeys.has(k)) {
                this.currentDivs().delete(k);
            }
        });
    },

    /**
     * Dictionary where user visualization preferences
     * for each divId are stored.
     */
    userOptCache: {},

    /**
     * Current scaling factor used for images copied to clipboard.
     */
    copyImgScaleFac: DEFAULT_IMG_OPTS.copyImgScaleFac,
};

export default Renderer;

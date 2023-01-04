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

import { getElementCenter, getViewPortRect } from './utils';

/**
 * ButtonTooltip class:
 * Creates a tooltip for the copy/cog buttons.
 */
class ButtonTooltip {
    /**
     * Constructor.
     * @param {Renderer} renderer parent Renderer
     * @param {string} text tooltip text
     */
    constructor(renderer, text) {
        this._renderer = renderer;
        this._text = text || null;
        this._isVisible = false;
        this._createTooltip();
    }

    /**
     * Create a tooltip HTML element and store it
     * on this. Set the tooltip to be hidden by default.
     * Also compute and store its width and height when
     * visible as we need it for positioning.
     */
    _createTooltip() {
        const prefix = this._renderer.getRdkStrRnrPrefix();
        this._containerClass = `${prefix}tooltip container`;
        this._spanClass = `${prefix}tooltip text`;
        const div = document.createElement('div');
        const span = document.createElement('span');
        const content = document.createTextNode(this._text);
        span.appendChild(content);
        div.appendChild(span);
        this._div = div;
        this._content = content;
        this._span = span;
        this._setVisibleClass();
        document.body.appendChild(div);
        const { width, height } = span.getBoundingClientRect();
        this._setHiddenClass();
        this._halfWidth = Math.round(0.5 * width);
        this._height = Math.round(height);
    }

    /**
     * Set the tooltip to be hidden (private).
     */
    _setHiddenClass() {
        this._div.className = `${this._containerClass} hidden`;
        this._span.className = `${this._spanClass} hidden`;
        this._isVisible = false;
    }

    /**
     * Set the tooltip to be visible (private).
     */
    _setVisibleClass() {
        this._div.className = `${this._containerClass} visible`;
        this._span.className = `${this._spanClass} visible`;
        this._isVisible = true;
    }

    /**
     * Returns whether the tooltip is currently visible.
     * @returns {boolean} true if visible, false if not
     */
    isVisible() {
        return this._isVisible;
    }

    /**
     * Returns the Y offset for the tooltip position.
     * @returns {Number} Y offset
     */
    getYOffset() {
        const Y_TOOLTIP_OFFSET = 10;
        return Y_TOOLTIP_OFFSET;
    }

    /**
     * Returns the current tooltip text.
     * @returns {string} tooltip text
     */
    getText() {
        return this._text;
    }

    /**
     * Sets the current tooltip text.
     * If text is null, the tooltip will not show up.
     * @param {string} text tooltip text
     */
    setText(text) {
        this._text = text;
        this._content.textContent = text;
    }

    /**
     * Set the tooltip position relative to parent.
     * @returns {boolean} true if success, false if failure
     */
    setPosition(parent, offsetIn) {
        const offset = offsetIn || { x: 0, y: 0 };
        const parentCenter = getElementCenter(parent);
        const viewPortRect = getViewPortRect();
        const height = this._height + this.getYOffset();
        const minLeft = window.pageXOffset;
        const maxLeft = viewPortRect.width - 2 * this._halfWidth;
        const minTop = window.pageYOffset;
        if (maxLeft < 0 || height > viewPortRect.height) {
            return false;
        }
        let left = minLeft + parentCenter.x - this._halfWidth + offset.x;
        if (left < minLeft) {
            left = minLeft;
        } else if (left > maxLeft) {
            left = maxLeft;
        }
        let top = minTop + parentCenter.y - height + offset.y;
        if (top < minTop) {
            top += height + this.getYOffset();
        }
        this._div.setAttribute('style', `top: ${top}px; left: ${left}px`);
        return true;
    }

    /**
     * Hide the tooltip (public).
     */
    hide() {
        this._setHiddenClass();
    }

    /**
     * Show the tooltip if possible (public).
     * @param {HTMLELement} parent element the tooltip belongs to
     */
    show(parent, offset) {
        if (this._text === null) {
            return;
        }
        if (this.setPosition(parent, offset)) {
            this._setVisibleClass();
        }
    }
}

export default ButtonTooltip;

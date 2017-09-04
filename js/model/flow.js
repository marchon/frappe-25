import Base from './base';

export default class extends Base {
    constructor(top, left, bottom, right) {
        super('flow', top, left);
        this.bottom = bottom || 0;
        this.right = right || 0;
        this.isDirty = true;
    }

    get bottom() { return this.top + this.height; }
    set bottom(bottom) { this.height = bottom - this.top; }
    get right() { return this.left + this.width; }
    set right(right) { this.width = right - this.left; }

    get prev() {
        let len = this._prev_.length;
        if(len>1) this._prev_ = [ this._prev_.pop() ];
        return this._prev_;
    }

    get next() {
        let len = this._next_.length;
        if(len>1) this._next_ = [ this._next_.pop() ];
        return this._next_;
    }

    get isFlow() { return true; }    

    // TODO: dirty check로 불필요한 계산 반복하지 않도록 처리해 보자.
    fitToNodes() {
        if(!this.isDirty) return;
        
        const
            p = this.prev[0] || { top: this.top, left: this.left, width: 0, height: 0},
            n = this.next[0] || { top: this.bottom, left: this.right, width: 0, height: 0},

            pcx = p.left + p.width/2,
            pcy = p.top + p.height/2,
            ncx = n.left + n.width/2,
            ncy = n.top + n.height/2,

            dx = ncx - pcx,
            dy = ncy - pcy,

            pu = (Math.max(Math.abs(dx)/(p.width||1), Math.abs(dy)/(p.height||1))*2)||1,
            nu = (Math.max(Math.abs(dx)/(n.width||1), Math.abs(dy)/(n.height||1))*2)||1;

        this.top = pcy + dy/pu;
        this.left = pcx + dx/pu;
        this.bottom = ncy - dy/nu;
        this.right = ncx - dx/nu;
    }
}
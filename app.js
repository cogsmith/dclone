AppExit = function (exit) {
    if (screen) { screen.destroy(); }
    console.log({ EXIT: exit });
    process.exit(1);
}

process.on('unhandledRejection', (reason, p) => { AppExit({ Msg: 'ERROR_UNEX_PromiseRejection' }); });
process.on('uncaughtException', (err) => { AppExit({ Msg: 'ERROR_UNEX_ThrowNoCatch', Err: err }); });
process.on('SIGINT', () => { AppExit({ Msg: 'EXIT_SIGINT' }); });
//process.on('exit', () => { AppExit({ Msg: 'EXIT_EXIT' }); });

const BXTERM = require("blessed-xterm");

const execa = require('execa');
const spawn = require('child_process').spawn;

//const stripAnsi = require('strip-ansi');
const stripAnsi = function (string) { return string.replace(ansiRegex(), ''); }
const ansiRegex = function ({ onlyFirst = false } = {}) {
    const pattern = ['[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)', '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'].join('|');
    return new RegExp(pattern, onlyFirst ? undefined : 'g');
}


const blessed = require('blessed');
const blessedc = require('blessed-contrib');
const Canvas = blessedc.canvas;
const Node = blessed.Node;
const Box = blessed.Box;

const XT = require('@cogsmith/xt').Init();
const App = XT.App; const LOG = XT.LOG;

//

bp = false;
screen = false;
App.TUI = {};
App.TUI.FX = {};
App.TUI.Node = {};

//

let MyGauge = function (options) {
    if (!(this instanceof Node)) { return new MyGauge(options); }

    var self = this;
    options = options || {};
    options.left = options.left || 2;

    self.options = options;
    self.options.stroke = options.stroke || 'magenta';
    self.options.fill = 'white';
    self.options.data = options.data || [];
    self.options.showLabel = options.showLabel !== false;

    Canvas.call(this, options, require('ansi-term'));

    this.on('attach', function () {
        if (self.options.stack) {
            var stack = this.stack = self.options.stack;
            this.setStack(stack);
        }
        else {
            var percent = this.percent = self.options.percent || 0;
            this.setData(percent);
        }
    });
}

MyGauge.prototype = Object.create(Canvas.prototype);
MyGauge.prototype.getOptionsPrototype = function () { return { percent: 10 }; };
MyGauge.prototype.type = 'gauge';

MyGauge.prototype.calcSize = function () {
    this.width = this.width - 2;
    this.canvasSize = { width: this.width + 0, height: this.height };
};

MyGauge.prototype.setData = function (data) {
    if (typeof (data) == typeof ([]) && data.length > 0) { this.setStack(data); }
    else if (typeof (data) == typeof (1)) { this.setPercent(data); }
};

MyGauge.prototype.setPercent = function (percent) {
    if (!this.ctx) { throw 'error: canvas context does not exist. setData() for gauges must be called after the gauge has been added to the screen via screen.append()'; }

    var c = this.ctx;
    c.strokeStyle = this.options.stroke;//'magenta'
    c.fillStyle = this.options.fill;//'white'

    c.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);
    if (percent < 1.001) { percent = percent * 100; }
    var width = percent / 100 * (this.canvasSize.width - 2);
    c.fillRect(1, 2, width, this.height);

    var textX = 7;
    if (width < textX) { c.strokeStyle = 'normal'; }

    // if (this.options.showLabel) c.fillText(Math.round(percent) + '%', textX, 3);
    if (this.options.showLabel) { c.fillText(currentStack.label || percent + '%', textX, this.height / 2); }
};

MyGauge.prototype.setStack = function (stack) {
    var colors = ['green', 'magenta', 'cyan', 'red', 'blue'];
    if (!this.ctx) { throw 'error: canvas context does not exist. setData() for gauges must be called after the gauge has been added to the screen via screen.append()'; }

    var c = this.ctx;
    var leftStart = 0;
    var textLeft = 5;
    c.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);

    for (var i = 0; i < stack.length; i++) {
        var currentStack = stack[i];

        let percent;
        if (typeof (currentStack) == typeof ({})) { percent = currentStack.percent; } else { percent = currentStack; }

        c.strokeStyle = currentStack.stroke || colors[(i % colors.length)]; // use specified or choose from the array of colors
        c.fillStyle = this.options.fill;//'white'

        textLeft = 5;
        if (percent < 1.001) { percent = percent * 100; }
        var width = percent / 100 * (this.canvasSize.width - 2);

        if (currentStack.stroke != 'black') { c.fillRect(leftStart, 0, width, this.height); }

        textLeft = (width / 2) - 1;
        var textX = leftStart + textLeft;

        if ((leftStart + width) < textX) { c.strokeStyle = 'normal'; }

        // if (this.options.showLabel) c.fillText(percent + '%', textX, 3);
        if (this.options.showLabel) { c.fillText(currentStack.label || percent + '%', textX, this.height / 2); }

        leftStart += width;
    }
};

App.TUI.Node.Gauge = MyGauge;

//

function MyTable(options) {
    var self = this;
    if (!(this instanceof Node)) { return new MyTable(options); }

    if (Array.isArray(options.columnSpacing)) { throw 'Error: columnSpacing cannot be an array.\r\n' + 'Note: From release 2.0.0 use property columnWidth instead of columnSpacing.\r\n' + 'Please refere to the README or to https://github.com/yaronn/blessed-contrib/issues/39'; }
    if (!options.columnWidth) { throw 'Error: A table must get columnWidth as a property. Please refer to the README.'; }

    options = options || {};
    options.columnSpacing = options.columnSpacing == null ? 10 : options.columnSpacing;
    options.bold = true;
    options.selectedFg = options.selectedFg || 'white';
    options.selectedBg = options.selectedBg || 'blue';
    options.fg = options.fg || 'green';
    options.bg = options.bg || '';
    options.interactive = (typeof options.interactive === 'undefined') ? true : options.interactive;

    //options.left = options.left || 1;
    //options.right = options.right || 1;

    this.options = options;
    Box.call(this, options);

    this.rows = blessed.list({
        //height: 0,
        top: 2,
        width: 0,
        left: 1,
        style: {
            selected: { fg: options.selectedFg, bg: options.selectedBg },
            item: { fg: options.fg, bg: options.bg }
        },
        keys: options.keys,
        vi: options.vi,
        mouse: options.mouse,
        tags: true,
        interactive: options.interactive,
        screen: this.screen
    });

    this.append(this.rows);

    this.on('attach', function () { if (self.options.data) { self.setData(self.options.data); } });
}

MyTable.prototype = Object.create(Box.prototype);
MyTable.prototype.type = 'table';
MyTable.prototype.focus = function () { this.rows.focus(); };

MyTable.prototype.render = function () {
    if (this.screen.focused == this.rows) { this.rows.focus(); }

    this.rows.width = this.width - 3;
    this.rows.height = this.height - 3;
    Box.prototype.render.call(this);
};

MyTable.prototype.setData = function (table) {
    var self = this;

    var dataToString = function (d) {
        var str = '';
        d.forEach(function (r, i) {
            var colsize = self.options.columnWidth[i];
            var strip = stripAnsi(r.toString());
            var ansiLen = r.toString().length - strip.length;
            var spaceLength = colsize - strip.length + self.options.columnSpacing;
            r = r.toString().substring(0, colsize + ansiLen); //compensate for ansi len
            if (spaceLength < 0) { spaceLength = 0; }
            var spaces = new Array(spaceLength).join(' ');
            str += r + spaces;
        });
        return str;
    };

    var formatted = [];

    table.data.forEach(function (d) { var str = dataToString(d); formatted.push(str); });
    this.setContent(dataToString(table.headers));
    this.rows.setItems(formatted);
};

MyTable.prototype.getOptionsPrototype = function () {
    return {
        keys: true,
        fg: 'white',
        interactive: false,
        label: 'Active Processes',
        width: '30%',
        height: '30%',
        border: { type: 'line', fg: 'blue' },
        columnSpacing: 10,
        columnWidth: [16, 12],
        data: {
            headers: ['col1', 'col2'],
            data: [
                ['a', 'b'],
                ['5', 'u'],
                ['x', '16.1']
            ]
        }
    };
};

App.TUI.Node.Table = MyTable;

//

App.Disks = {};

App.Disks.GetInfo = function () {
    let exec = execa.commandSync('lsblk -pJ --output-all', { shell: true });
    let info = JSON.parse(exec.stdout);
    return info;
}

App.Disks.GetTableData = function () {
    let info = App.Disks.GetInfo();

    let disks = {};
    let parts = {};

    for (let dev of info.blockdevices) {
        if (dev.type == 'disk') { disks[dev.name] = dev; }
        if (dev.children) {
            for (let child of dev.children) { if (!parts[dev.name]) { parts[dev.name] = []; } parts[dev.name].push(child); }
        }
    }

    let rows = [];
    for (let diskid in disks) {
        let disk = disks[diskid];
        //let row = [disk.name, disk.vendor, disk.model, disk.fstype, disk.label, disk.size, disk.fsused, disk.fsavail, disk.mountpoint];
        let row = [disk.name, disk.vendor, disk.model, disk.size];
        rows.push(row);
    }

    for (let rowi = 0; rowi < rows.length; rowi++) {
        let r = rows[rowi];
        for (let i = 0; i < r.length; i++) { if (!r[i]) { rows[rowi][i] = ''; } }
    }

    return rows;
}

//

App.TUI.Append = function (el, to) {
    if (typeof (el) == 'object') {
        if (to.ViewHeight == undefined) { to.ViewHeight = 0; }
        if (to.ViewHeightFixed == undefined) { to.ViewHeightFixed = 0; }

        el.top = to.ViewHeight;
        if (el.position.bottom >= 0) { delete el.position.top; }

        to.ViewHeight = to.ViewHeight + el.height;
        //if (el.flex) { el.height = to.ViewHeight - to.ViewHeightFixed; } else { to.ViewHeightFixed += el.height; }
        if (el.flex) { } else { to.ViewHeightFixed += el.height; }

        if (!to.ViewHeights) { to.ViewHeights = []; }
        to.ViewHeights.push(el.height);

        to.append(el);
    }
    else { LOG.WARN('TUI.Append: !EL'); }
}

App.TUI.Init = function () {
    let bp = blessed.program(); //bp.cols = 99; bp.rows = 20;
    screen = blessed.screen({ debug: true, autoPadding: false, dockBorders: true, program: bp, cursor: { blink: true, color: 'red' } });
    App.TUI.BP = bp; App.TUI.Screen = screen;

    screen.key(['q', 'C-c'], function (ch, key) { AppExit(); });
    //screen.key(['escape'], function (ch, key) { AppExit(); });

    App.TUI.NullBox = blessed.box({ height: 0, width: 0, hidden: false, style: { fg: 'white', bg: 'red' } });

    for (let k in App.TUI.FX) {
        LOG.DEBUG('TUI.FX: ' + k);
        let el = App.TUI.FX[k].apply(null, []);
        if (!el) { el = App.TUI.NullBox; LOG.WARN('TUI.FX: ' + k + ' = NullBox'); }
        App.TUI[k] = el;
    }

    App.TUI.DiskView.append(App.TUI.ListBox);
    App.TUI.DiskView.append(App.TUI.UsageBox);

    App.TUI.Append(App.TUI.DiskView, App.TUI.ViewsBox);
    App.TUI.Append(App.TUI.FilesystemView, App.TUI.ViewsBox);
    App.TUI.Append(App.TUI.OutputView, App.TUI.ViewsBox);
    App.TUI.Append(App.TUI.AppView, App.TUI.ViewsBox);

    for (let z of App.TUI.ViewsBox.children) {
        if (z.flex) {
            z.height = App.TUI.ViewsBox.height - App.TUI.ViewsBox.ViewHeightFixed;
            for (let zz of z.children) {
                if (zz.flex) { zz.height = App.TUI.ViewsBox.height - App.TUI.ViewsBox.ViewHeightFixed; }
            }
        }
    }

    for (let i = 1; i < App.TUI.ViewsBox.children.length; i++) {
        let zlast = App.TUI.ViewsBox.children[i - 1];
        let znow = App.TUI.ViewsBox.children[i];
        if (zlast.flex) { znow.top = 5 + App.TUI.ViewsBox.height - App.TUI.ViewsBox.ViewHeightFixed; screen.render(); }
    }

    App.TUI.Screen.append(App.TUI.Header);
    App.TUI.Screen.append(App.TUI.Footer);
    App.TUI.Screen.append(App.TUI.ViewsBox);

    App.TUI.Screen.render();
}

//

App.TUI.FX.InputZone = function () {
    let box = blessed.box({ height: 1, width: '50%', top: 0, left: 0 });
    return box;
}

App.TUI.FX.InputBox = function () {
    let box = blessed.textbox({
        //top: 0, left: 0, height: 1, width: '50%',
        style: { fg: 'white', bg: 'blue', focus: { fg: 'black', bg: 'white' } },
        tags: true,
        //content: '{green-fg}✔️ ▶ ✅  {/green-fg} ▶ ⭐ ⛔ ✅ HEADER_LEFT  ⏸️ ⚡'
        // content: '▶ DCLONE ◀'
        content: '▶ DCLONE: Disk Cloner [0.0.1-dev]'
    });

    box.on('mouseout', () => { box.setContent(' ▶ DCLONE: Disk Cloner [0.0.1-dev]'); screen.render(); });
    box.on('mouseover', () => { box.setContent(' ▶ COGSMITH IT Solutions Provider'); screen.render(); });

    return box;
}

App.TUI.FX.InfoBox = function () {
    let box = blessed.box({
        top: 0, right: 1, height: 1, width: '50%', align: 'right',
        style: { fg: 'white', bg: 'blue' },
        content: 'pi @ raspberrypi /snapshot ◀'
    });

    return box;
}

App.TUI.FX.StatusBox = function () {
    let box = blessed.textbox({
        bottom: 0, left: 0, height: 1, width: '50%',
        style: { fg: 'white', bg: 'blue', focus: { bg: 'red' }, hover: { bg: 'green' } },
        content: '▶ FOOTER_LEFT',
        mouse: true,
        inputOnFocus: true, focus: { bg: 'red' },
        tags: true
    });

    //box.setContent(' ┋ ▾ ◂ ◆ ▸ ◀ ▲ ❯ ☒	> ▼ ◄ ⚠	‼ ℹ	i  ✔	√ 	█ ■ ◉  ◉ ♦ ━ ◇ ▶ ✖	×	►	◊ ☰	≡ ▶	►  ≡ ◆ ★ ♥	✶  ★ ⬢  ⏏ ♦  ⏸  ⏺  ⏭  ▙  ▣  ■  ◼ ◉  STATUS')
    //box.setContent(' • ◆ ■ ◀ █ ▶ ▲ ▼ ♥ ≡ = - STATUS')
    box.setContent(' {bold}{#777-fg}◆{/#777-fg}{/bold} {bold}App.Init:{/bold} DCLONE'); screen.render();

    loopfx = function () {
        box.setContent(' {bold}{yellow-fg}◆{/yellow-fg}{/bold} {bold}App.Init:{/bold} Loading...'); screen.render();
        setTimeout(function () { box.setContent(' {bold}{#777-fg}◆{/#777-fg}{/bold} {bold}App.Init:{/bold} Loading...'); screen.render(); }, 500 + 250);
        setTimeout(function () { box.setContent(' {bold}{#777-fg} {/#777-fg}{/bold} {bold}App.Init:{/bold} Loading...'); screen.render(); }, 500 + 500);
        setTimeout(function () { box.setContent(' {bold}{#777-fg}◆{/#777-fg}{/bold} {bold}App.Init:{/bold} Loading...'); screen.render(); }, 500 + 750);
    }; setInterval(loopfx, 500 + 1000);

    return box;
}

App.TUI.FX.ClockBox = function () {
    let box = blessed.textbox({
        bottom: 0, right: 0, height: 1, width: '50%', align: 'right',
        style: { fg: 'white', bg: 'blue', },
        content: 'FOOTER_RIGHT ◀',
        mouse: true,
        inputOnFocus: false,
    });

    setInterval(function () { box.setContent(new Date().toLocaleTimeString() + ' '); screen.render(); }, 500);

    return box;
}

//

App.TUI.FX.ListBox = function () {
    var box = blessed.box({ height: 7, padding: { top: 0, left: 1, right: 1, bottom: 0 } });

    var boxlist = MyTable({
        top: 0,
        keys: true,
        vi: true,
        interactive: true,
        fg: 'white',
        selectedFg: 'white', selectedBg: 'blue',
        label: '[ 5 Disks = 7.10 TB ]',
        width: 55, border: { type: "line", fg: "blue" }, columnSpacing: 3, columnWidth: [12, 12, 16, 8]
    });

    boxlist.focus()

    box.append(boxlist);

    let rows = App.Disks.GetTableData();
    boxlist.setData({
        // headers: [('ID FS LABEL SIZE USED USED FREE FREE MOUNT'.split(' '))],
        headers: ['ID', 'VENDOR', 'MODEL', 'SIZE'],
        data: rows
    })

    screen.on('keypress', function (key, code) {
        if (code.name == 'up' || code.name == 'down') {
            App.TUI.UsageBox.setLabel(code.name);
            screen.render();
        }
    });


    boxlist.rows.on('select', (el, index) => {
        let inputpromptmsg = ' ▶ Enter Image Filename:';
        let inputprompt = new blessed.box({ width: inputpromptmsg.length + 1, style: { bg: 'white', fg: 'black' }, content: inputpromptmsg });
        App.TUI.InputBox.left = inputpromptmsg.length + 1;

        App.TUI.InputBox.setContent('LABEL_ZG_FSLIST_' + rows[index][0]); screen.render();
        App.TUI.InputBox.setValue('LABEL_ZG_FSLIST_' + rows[index][0]); screen.render();

        App.TUI.Header.remove(App.TUI.InputZone);
        App.TUI.InputZone.destroy();
        App.TUI.InputZone = App.TUI.FX.InputZone();
        App.TUI.InputZone.append(inputprompt);
        App.TUI.InputZone.append(App.TUI.InputBox);
        App.TUI.Header.append(App.TUI.InputZone);

        screen.render();

        App.TUI.InputBox.readInput(function (z) {
            App.TUI.Header.remove(App.TUI.InputZone);
            App.TUI.InputZone.destroy();
            App.TUI.InputBox.left = 0;
            App.TUI.InputZone = App.TUI.FX.InputZone();
            App.TUI.InputZone.append(App.TUI.InputBox);
            App.TUI.Header.append(App.TUI.InputZone);
            App.TUI.InputBox.setContent(' ▶ DCLONE: Disk Cloner [0.0.1-dev]'); screen.render();
        });
    });

    App.TUI.BoxList = boxlist;

    return box;
}

App.TUI.LogAndExit = function (msg) {
    screen.destroy();
    console.log(msg);
    process.exit(1);
}

App.TUI.FX.UsageBox = function () {
    var box = blessed.box({
        interactive: true,
        right: 0, top: 0,
        //keys: true
        //, vi: true
        fg: 'white',
        //bg: '#ff0000',
        selectedFg: 'white', selectedBg: 'blue',
        label: '[ /dev/sda ]',
        width: screen.width - 55 + 1,
        height: 7,
        padding: 0,
        border: { type: "line", fg: "blue" }
    })

    let gauge = MyGauge({
        height: 3, top: 2, width: box.width - 1, zalign: 'right', zpadding: 0,
        style: { fg: 'white' }, //border: { type: "line", fg: "cyan" },
        //label: '[ Partitions ]',
        showLabel: true,
        stack: [{ percent: 5, stroke: [99, 99, 99] }, { percent: 30, stroke: 'cyan' }, { percent: 65, stroke: 'blue' }],
    });
    box.append(gauge);

    let g1 = MyGauge({
        height: 1, top: 5, width: box.width - 1, padding: 0,
        style: { fg: 'white' }, //border: { type: "line", fg: "cyan" },
        showLabel: false,
        stack: [{ percent: 3, stroke: 'yellow' }, { label: 'ROOT', percent: 2, stroke: 'green' }, { label: 'DATA', percent: 20, stroke: 'yellow' },
        { percent: 10, stroke: 'green' }, { label: 'ROOT', percent: 5, stroke: 'yellow' }, { label: 'DATA', percent: 60, stroke: 'green' }],
    });
    box.append(g1);

    let g2 = MyGauge({
        height: 1, top: 1, width: box.width - 1, padding: 0,
        style: { fg: 'white' }, //border: { type: "line", fg: "cyan" },
        showLabel: true,
        stack: [{ label: "BOOT", percent: 5, stroke: 'black' }, { label: 'ROOT', percent: 30, stroke: 'black' }, { label: 'DATA', percent: 65, stroke: 'black' }],
    });
    box.append(g2);

    let g3 = MyGauge({
        height: 1, top: 7, width: box.width - 1, padding: 0,
        style: { fg: 'white' }, //border: { type: "line", fg: "cyan" },
        //label: '[ Partitions ]',
        showLabel: true,
        stack: [{ label: "150m", percent: 5, stroke: 'black' }, { label: '16g', percent: 30, stroke: 'black' }, { label: '250g', percent: 65, stroke: 'black' }],
    });
    //box.append(g3);

    return box;
}

App.TUI.FX.FilesystemBox = function () {
}

App.TUI.FX.OutputBox = function () {
}

App.TUI.FX.LogBox = function () {
}

App.TUI.FX.StatBox = function () {
}

//

App.TUI.FX.Header = function () {
    let header = blessed.box({
        top: 0, left: 0, height: 1, width: '100%',
        style: { fg: 'white', bg: 'blue' },
    });

    header.append(App.TUI.InfoBox);

    App.TUI.InputZone.append(App.TUI.InputBox);
    header.append(App.TUI.InputZone);

    setTimeout(() => { App.TUI.InputBox.setContent(' ▶ DCLONE: Disk Cloner [0.0.1-dev]'); screen.render(); }, 99);

    return header;
}

App.TUI.FX.Footer = function () {
    let footer = blessed.box({
        bottom: 0, left: 0, height: 1, width: '100%',
        style: { fg: 'white', bg: 'blue' },
    });

    footer.append(App.TUI.StatusBox);
    footer.append(App.TUI.ClockBox);

    return footer;
}

App.TUI.FX.ViewsBox = function () {
    let box = blessed.box({
        top: 1, left: 0, height: screen.height - 2, width: '100%',
        style: { fg: 'white', bg: 'black' },
    });
    return box;
}

//

App.TUI.FX.DiskView = function () {
    let box = blessed.box({ height: 6 });
    return box;
}

App.TUI.FX.FilesystemView = function () {
    let box = blessed.box({ height: 6, style: { fg: 'white', bg: 'red' } });
    box.flex = true;

    const opts = {
        padding: { top: 0, left: 1, right: 1, bottom: 0 },
        shell: '/bin/sh',
        //args: ['-c', '/usr/bin/curl -o /dev/null https://speed.hetzner.de/100MB.bin'],
        args: ['-c', '(lspci;echo;lsusb)'],
        env: process.env,
        cwd: process.cwd(),
        cursorType: "block",
        border: "line",
        scrollback: 1000,
        style: {
            fg: "default", bg: "default",
            border: { type: "line", fg: "blue" },
            focus: { border: { fg: "green" } },
            scrolling: { border: { fg: "red" } }
        }
    }

    let bxterm = new BXTERM(Object.assign({}, opts, {
        //args: ['-c', '(lsblk -Tp --output NAME,MAJ:MIN,UUID,SERIAL,STATE,TRAN,PTTYPE,TYPE,FSTYPE,LABEL,MOUNTPOINT,SIZE,FSUSED,FSUSE%,FSAVAIL,RO,RM,HOTPLUG | cut -c -' + (screen.width - 4) + ')'],
        args: ['-c', '(lsblk -Tp --output NAME,MAJ:MIN,STATE,TRAN,PTTYPE,TYPE,FSTYPE,LABEL,MOUNTPOINT,SIZE,FSUSED,FSUSE%,FSAVAIL,RO,RM,HOTPLUG | cut -c -' + (screen.width - 4) + ')'],
        width: screen.width, height: 4,
        label: "[ Filesystems ]",
        border: { type: "line", fg: "blue" },
    }));
    bxterm.flex = true;

    box.append(bxterm);

    return box;
}

App.TUI.FX.OutputView = function () {
    let box = blessed.box({ label: 'Shell Output', height: 8, border: { type: "line", fg: "blue" }, style: { fg: 'white', bg: 'magenta' } });
    return box;
}

App.TUI.FX.AppView = function () {
    let box = blessed.box({ label: 'App Info', height: 8, bottom: 0, left: 0, border: { type: "line", fg: "blue" }, style: { fg: 'white', bg: 'green' } });
    return box;
}

//

App.InitArgs = function () {
    //App.Argy = yargs(process.argv);
}

App.InitInfo = function () {
    App.SetInfo('App', function () { return 'DCLONE' });
}

App.InitData = function () {
}

App.Init = function () {
}

App.InitDone = function () {
}

App.Main = function () {

    let rows = App.Disks.GetTableData();

    App.TUI.Init();

    setInterval(() => { }, 100);
}

App.Run();
// npm install blessed blessed-contrib blessed-xterm execa ansi-term @cogsmith/xt

const nodeos = require('os');

const JSONFANCY = function (x) { return require('util').inspect(x, { colors: true, depth: null, breakLength: 99 }); };

AppExit = function (exit) {
    try { screen.destroy(); } catch (ex) { }
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

        textLeft = (width / 2) - ((currentStack.label ? currentStack.label.length : 0) / 2) + 2;
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

App.Disks.BackupPath = '/backup';

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

    let sizetotal = 0;

    App.Disks.DiskDB = {};
    App.Disks.Usages = {};
    let rows = [];
    for (let diskid in disks) {
        let disk = disks[diskid];
        App.Disks.DiskDB[diskid] = disk;
        //let row = [disk.name, disk.vendor, disk.model, disk.fstype, disk.label, disk.size, disk.fsused, disk.fsavail, disk.mountpoint];
        let row = [disk.name, disk.vendor, disk.model, disk.size];
        rows.push(row);

        disk.size = disk.size.toString() || '';
        let sizeint = 0; let sizenum = disk.size.replace('M', '').replace('G', '').replace('T', '');
        if (false) { }
        else if (disk.size.includes('M')) { sizeint = sizenum / 1024; }
        else if (disk.size.includes('G')) { sizeint = sizenum * 1; }
        else if (disk.size.includes('T')) { sizeint = sizenum * 1024; }
        sizetotal += sizeint;

        for (let part of disk.children) {
            partsizetext = part.size;
            part.size = part.size.toString() || '';
            let partsizeint = 0; let partsizenum = part.size.replace('M', '').replace('G', '').replace('T', '');
            if (false) { }
            else if (part.size.includes('M')) { partsizeint = partsizenum / 1024; }
            else if (part.size.includes('G')) { partsizeint = partsizenum * 1; }
            else if (part.size.includes('T')) { partsizeint = partsizenum * 1024; }

            console.log(part.name + ' = ' + part['fsuse%']);
            let partused = 0; try { partused = part['fsuse%'].replace('%', ''); } catch (ex) { }
            let usage = { ID: part.name, Label: part.label, Size: partsizeint, DiskSize: sizeint, SizeText: part.size, Used: partused * 1 };
            //if (!App.Disks.Usages[diskid]) { App.Disks.Usages[diskid] = {}; } App.Disks.Usages[diskid][part.name] = usage;
            if (!App.Disks.Usages[diskid]) { App.Disks.Usages[diskid] = []; } App.Disks.Usages[diskid].push(usage);
            //console.log(disk);
        }

    }
    App.Disks.SizeTotal = sizetotal;

    for (let rowi = 0; rowi < rows.length; rowi++) {
        let r = rows[rowi];
        for (let i = 0; i < r.length; i++) { if (!r[i]) { rows[rowi][i] = ''; } }
    }

    return rows;
}

App.Disks.DB = { Rows: App.Disks.GetTableData(), Info: App.Disks.GetInfo(), DiskDB: App.Disks.DiskDB, Usages: App.Disks.Usages };

//

App.TUI.Append = function (el, to) {
    if (typeof (el) == 'object') {
        if (to.ViewHeight == undefined) { to.ViewHeight = 0; }
        if (to.ViewHeightFixed == undefined) { to.ViewHeightFixed = 0; }

        el.top = to.ViewHeight;
        if (el.position.bottom >= 0) { delete el.position.top; }

        to.ViewHeight = to.ViewHeight + el.height;
        if (el.flex) { el.height = to.ViewHeight - to.ViewHeightFixed; } else { to.ViewHeightFixed += el.height; }
        //if (el.flex) { } else { to.ViewHeightFixed += el.height; }

        if (!to.ViewHeights) { to.ViewHeights = []; }
        to.ViewHeights.push(el.height);

        to.append(el);

        screen.render();
    }
    else { LOG.WARN('TUI.Append: !EL'); }
}

App.TUI.Init = function () {
    let bp = blessed.program();
    //bp.cols = 144; bp.rows = 36;
    //bp.cols = 99; bp.rows = 24;
    //bp.cols = 80; bp.rows = 20;

    screen = blessed.screen({ debug: true, autoPadding: false, dockBorders: true, program: bp, cursor: { blink: true, color: 'red' } });
    App.TUI.BP = bp; App.TUI.Screen = screen;

    screen.key(['q', 'C-c'], function (ch, key) { AppExit(); });
    //screen.key(['escape'], function (ch, key) { AppExit(); });

    App.TUI.NullBox = blessed.box({ height: 0, width: 0, hidden: false, style: { fg: 'white', bg: 'red' } });

    for (let k in App.TUI.FX) {
        //LOG.TRACE('TUI.FX: ' + k);
        let el = App.TUI.FX[k].apply(null, []);
        if (!el) { el = App.TUI.NullBox; LOG.WARN('TUI.FX: ' + k + ' = NULLBOX'); }
        App.TUI[k] = el;
    }

    App.TUI.DiskView.append(App.TUI.ListBox);
    App.TUI.DiskView.append(App.TUI.UsageBox);

    App.TUI.Append(App.TUI.DiskView, App.TUI.ViewsBox);
    //App.TUI.Append(App.TUI.FilesystemView, App.TUI.ViewsBox);
    App.TUI.Append(App.TUI.OutputView, App.TUI.ViewsBox);
    //App.TUI.Append(App.TUI.AppView, App.TUI.ViewsBox);

    //App.TUI.AppView.append(App.TUI.NodeStatsBox);
    //App.TUI.AppView.append(App.TUI.AppInfoBox);

    for (let z of App.TUI.ViewsBox.children) {
        if (z.flex) {
            z.height = App.TUI.ViewsBox.height - App.TUI.ViewsBox.ViewHeightFixed;
            //z.height = screen.height - 2 - App.TUI.ViewsBox.ViewHeightFixed;
            for (let zz of z.children) {
                if (zz.flex) { zz.height = App.TUI.ViewsBox.height - App.TUI.ViewsBox.ViewHeightFixed; }
                //if (zz.flex) { zz.height = screen.height - 2 - App.TUI.ViewsBox.ViewHeightFixed; }
            }
        }
    }

    for (let i = 1; i < App.TUI.ViewsBox.children.length; i++) {
        let zlast = App.TUI.ViewsBox.children[i - 1];
        let znow = App.TUI.ViewsBox.children[i];
        if (zlast.flex) { znow.top = 10 + App.TUI.ViewsBox.height - App.TUI.ViewsBox.ViewHeightFixed; screen.render(); }
    }

    App.TUI.Screen.append(App.TUI.Header);
    App.TUI.Screen.append(App.TUI.Footer);
    App.TUI.Screen.append(App.TUI.ViewsBox);

    App.TUI.Screen.render();
}

//

App.TUI.FX.NodeStatsBox = function () {
    let box = blessed.box({
        top: 0, height: 8, width: '20%', right: 0,
        style: { fg: 'white', bg: 'black' },
        content: 'NODESTATBOX'
    });

    return box;
}

App.TUI.FX.AppInfoBox = function () {
    let box = blessed.box({
        top: 0, height: 8, width: '80%',
        style: { fg: 'white', bg: 'black' },
        content: 'APPINFOBOX'
    });

    return box;
}

App.TUI.FX.InputZone = function () {
    let box = blessed.box({ height: 1, width: '75%', top: 0, left: 0 });
    return box;
}

App.TUI.FX.InputBox = function () {
    let box = blessed.textbox({
        //top: 0, left: 0, height: 1, width: '50%',
        style: { fg: 'white', bg: 'blue', focus: { fg: 'black', bg: 'white' } },
        tags: true,
        //content: '{green-fg}✔️ ▶ ✅  {/green-fg} ▶ ⭐ ⛔ ✅ HEADER_LEFT  ⏸️ ⚡'
        // content: '▶ DCLONE ◀'
        //content: '▶ DCLONE: Disk Cloner [0.0.1-dev]'
        content: ' ▶ ' + App.Meta.Full + ''
    });

    box.on('mouseout', () => { box.setContent(' ▶ ' + App.Meta.Full + ''); screen.render(); });
    box.on('mouseover', () => { box.setContent(' ▶ COGSMITH IT Solutions Provider'); screen.render(); });

    return box;
}

App.TUI.FX.InfoBox = function () {
    let box = blessed.box({
        top: 0, right: 1, height: 1, width: '25%', align: 'right',
        style: { fg: 'white', bg: 'blue' },
        content: nodeos.userInfo().username + ' @ ' + nodeos.hostname() + ' ' + App.Disks.BackupPath + ' ◀'
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

    var label = '[ ' + App.Disks.DB.Rows.length + ' disks = ' + Math.floor(App.Disks.SizeTotal / 10) + ' GB' + ' ]';

    //App.TUI.LogAndExit(JSON.stringify(App.Disks.DB));

    var boxlist = MyTable({
        top: 0,
        keys: true,
        vi: true,
        interactive: true,
        fg: 'white',
        selectedFg: 'white', selectedBg: 'blue',
        label: label,
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
    //App.Disks.DB.Rows = rows;

    screen.on('keypress', function (key, code) {
        if (code.name == 'up' || code.name == 'down') {
            setTimeout(() => {
                App.TUI.UsageBox.destroy();
                App.TUI.UsageBox = App.TUI.FX.UsageBox();
                App.TUI.DiskView.append(App.TUI.UsageBox);
                screen.render();
                let rowdata = false; try { rowdata = App.Disks.DB.Rows[App.TUI.ListBox.children[0].rows.selected]; } catch (ex) { };
                //App.TUI.UsageBox.setLabel('[ ' + rowdata[0] + ' = ' + rowdata[3] + ' ]');
                screen.render();
            }, 10);
            //console.log(rowdata);
        }
    });

    boxlist.rows.on('select', (el, index) => {
        let inputpromptmsg = ' ▶ Enter Backup Filename: ' + App.Disks.BackupPath + '/';
        let inputprompt = new blessed.box({ width: inputpromptmsg.length + 1, style: { bg: 'white', fg: 'black' }, content: inputpromptmsg });
        App.TUI.InputBox.left = inputpromptmsg.length + 0;

        if (0) {
            const JSONFANCY = function (x) { return require('util').inspect(x, { colors: true, depth: null, breakLength: 99 }); };
            screen.destroy();
            console.log("\n\n\n\n========\n\n\n\n");
            console.log(JSONFANCY(App.Disks.DB));
            //LOG.WARN('Disks.DB', App.Disks.DB);
            process.exit(1);
        }

        let diskid = App.Disks.DB.Rows[index][0];
        let partlabels = []; for (let zp of App.Disks.DB.Usages[diskid]) { partlabels.push(zp.Label); }

        //let backuplabel = rows[index][0];
        let dnow = new Date().toISOString().replace(/(T|-|:|\.)/g, '').substring(0, 12);
        let disksizetext = Math.ceil(App.Disks.DB.Usages[diskid][0].DiskSize) + 'GB';
        let backuplabel = 'DISK' + '_' + partlabels.join('+') + '_' + disksizetext + '.' + dnow;
        App.TUI.InputBox.setContent(backuplabel); screen.render();
        App.TUI.InputBox.setValue(backuplabel); screen.render();

        App.TUI.Header.remove(App.TUI.InputZone);
        App.TUI.InputZone.destroy();
        App.TUI.InputZone = App.TUI.FX.InputZone();
        App.TUI.InputZone.append(inputprompt);
        App.TUI.InputZone.append(App.TUI.InputBox);
        App.TUI.Header.append(App.TUI.InputZone);

        screen.render();

        App.TUI.InputBox.readInput(function (z) {
            App.DoBackup(diskid, App.Disks.BackupPath, App.TUI.InputBox.value);

            App.TUI.Header.remove(App.TUI.InputZone);
            App.TUI.InputZone.destroy();
            App.TUI.InputBox.left = 0;
            App.TUI.InputZone = App.TUI.FX.InputZone();
            App.TUI.InputZone.append(App.TUI.InputBox);
            App.TUI.Header.append(App.TUI.InputZone);
            App.TUI.InputBox.setContent(' ▶ ' + App.Meta.Full + ''); screen.render();
        });
    });

    App.TUI.BoxList = boxlist;

    return box;
}

App.DoBackup = function (diskid, outdir, backupfile) {
    App.BXTERM.write("\n\r\n");
    App.BXTERM.write('▶ DCLONE Backup: ' + diskid + ' => ' + outdir + '/' + backupfile);
    App.BXTERM.write("\n\r\n");
    //App.BXTERM.spawn('/bin/sh', ['-c', '/usr/bin/curl -o /dev/null https://speed.hetzner.de/100MB.bin']);
    App.BXTERM.spawn('/bin/bash', ['-c', 'echo 123 ; echo 999']);

    let sqfsdir = outdir + '';
    let cmds = [];
    cmds.push('mkdir -p ' + sqfsdir);
    cmds.push('cd ' + sqfsdir);
    cmds.push('time mksquashfs /dev/null ./' + backupfile + '.sqfs -p "' + backupfile + '.img f 444 root root dd if=' + diskid + ' bs=8M"');
    let cmd = '(' + cmds.join(' ; ') + ')';
    App.BXTERM.write(cmd);
    App.BXTERM.write("\n\r\n");
    App.BXTERM.spawn('/bin/bash', ['-c', cmd]);
}

App.TUI.LogAndExit = function (msg) {
    screen.destroy();
    msg = JSONFANCY(msg);
    console.log(msg);
    process.exit(1);
}

App.TUI.FX.UsageBox = function () {
    let rowdata = false; try { rowdata = App.Disks.DB.Rows[App.TUI.ListBox.children[0].rows.selected]; } catch (ex) { };
    let diskid = rowdata[0];
    let disksize = rowdata[3];

    //App.TUI.LogAndExit(App.Disks.DB.Usages);
    //App.TUI.LogAndExit(App.Disks.DB.Usages[diskid]);

    let g0stack = [];
    let g1stack = [];
    let g2stack = [];

    let sizes = [];
    let usedtotal = 0;
    let zi = 0;
    let gstrokes = ['cyan', 'blue', 'cyan', 'blue', 'cyan', 'blue', 'cyan', 'blue', 'cyan', 'blue'];
    let vpz = 100;
    for (let z of App.Disks.DB.Usages[diskid]) {
        let p = z.Size / z.DiskSize * 100;
        if (p < 10) { vpz = vpz - 10; } // else { vpz = vpz - p; }
    }
    for (let z of App.Disks.DB.Usages[diskid]) {
        sizes.push(z.Size);
        usedtotal += Math.floor((z.Used / 100) * (z.Size / z.DiskSize) * 100);
        let p = (z.Size / z.DiskSize) * 100;
        let vp = p; if (p > vpz) { vp = vpz; vpz = vpz - vp; } if (p < 10) { vp = 10; }
        let g1p1 = (z.Used / 100) * vp;
        let g1p2 = ((100 - z.Used) / 100) * vp;
        if (g1p1 == 1) { g1p1 = 1.01; }
        if (g1p2 == 1) { g1p2 = 1.01; }
        if (g1p1 < 0.01) { g1p1 = 0.01; }
        if ((g1p1 + g1p2) > vp) { g1p2 = (vp - g1p1) * 1; }
        //g1p2 = p - g1p1 - 0.5;
        g0stack.push({ label: Math.floor(p) + '%', percent: vp, stroke: gstrokes[zi] });
        g2stack.push({ label: z.Label, percent: vp, stroke: 'black' });
        g1stack.push({ u: z.Used, p: p, vp: vp, percent: g1p1, stroke: 'yellow' });
        g1stack.push({ u: z.Used, p: p, vp: vp, percent: g1p2, stroke: 'green' });
        zi++;
    }

    if (diskid == '0/dev/mmcblk0') {
        //console.log(g0stack);
        console.log(g1stack);
        //console.log(g2stack);
    }

    //App.TUI.LogAndExit({ G0: g0stack, G2: g2stack, G1: g1stack });

    //console.log(usedtotal);

    let boxlabel = '[ ' + diskid + ' = ' + disksize + ' GB'; if (usedtotal > 0) { boxlabel += ' = ' + usedtotal + '% Used'; } else { boxlabel += ' = Not Mounted'; } boxlabel += ' ]';
    var box = blessed.box({
        interactive: true,
        right: 0, top: 0,
        //keys: true
        //, vi: true
        fg: 'white',
        //bg: '#ff0000',
        selectedFg: 'white', selectedBg: 'blue',
        label: boxlabel,
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
        stack: g0stack
    });
    box.append(gauge);


    let g1 = MyGauge({
        height: 1, top: 5, width: box.width - 1, padding: 0,
        style: { fg: 'white' }, //border: { type: "line", fg: "cyan" },
        showLabel: false,
        /*
        stack: [
            { percent: 3, stroke: 'yellow' }, { percent: 2, stroke: 'green' },
            { percent: 20, stroke: 'yellow' }, { percent: 10, stroke: 'green' },
            { percent: 5, stroke: 'yellow' }, { percent: 60, stroke: 'green' }
        ],
        */
        stack: g1stack
    });
    box.append(g1);

    let g2 = MyGauge({
        height: 1, top: 1, width: box.width - 1, padding: 0,
        style: { fg: 'white' }, //border: { type: "line", fg: "cyan" },
        showLabel: true,
        stack: g2stack
    });
    box.append(g2);

    setTimeout(() => {
        screen.append(blessed.box({ height: 1, top: 6, right: 1, width: 1, style: { fg: 'white', bg: 'black' } }));
        screen.render();
    }, 10);

    return box;
}

//App.TUI.FX.FilesystemBox = function () {}

//App.TUI.FX.OutputBox = function () {}

//App.TUI.FX.LogBox = function () {}

//App.TUI.FX.StatBox = function () {}

//

App.TUI.FX.Header = function () {
    let header = blessed.box({
        top: 0, left: 0, height: 1, width: '100%',
        style: { fg: 'white', bg: 'blue' },
    });

    header.append(App.TUI.InfoBox);

    App.TUI.InputZone.append(App.TUI.InputBox);
    header.append(App.TUI.InputZone);

    setTimeout(() => { App.TUI.InputBox.setContent(' ▶ ' + App.Meta.Full + ''); screen.render(); }, 99);

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
    let box = blessed.box({ height: 10, style: { fg: 'white', bg: 'red' } });
    //box.flex = true;

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
        width: screen.width, height: box.height,
        label: "[ Filesystems ]",
        border: { type: "line", fg: "blue" },
    }));
    bxterm.flex = true;

    box.append(bxterm);

    return box;
}

App.TUI.FX.OutputView = function () {
    let box = blessed.box({ label: 'Shell Output', height: 10, border: { type: "line", fg: "blue" }, style: { fg: 'white', bg: 'magenta' } });
    box.flex = true;

    let lsblk = 'lsblk -Tp --output NAME,MAJ:MIN,STATE,TRAN,PTTYPE,TYPE,FSTYPE,LABEL,MOUNTPOINT,SIZE,FSUSED,FSUSE%,FSAVAIL,RO,RM,HOTPLUG | cut -c -' + (screen.width - 4) + '';
    const opts = {
        padding: { top: 0, left: 1 },
        shell: '/bin/sh',
        //args: ['-c', '/usr/bin/curl -o /dev/null https://speed.hetzner.de/100MB.bin'],
        //args: ['-c', '(sudo fdisk --list)'],        
        //args: ['-c', '(uname -a;echo;' + lsblk + ';echo;sudo bash /zx/dclone/test_cmd_backup.sh)'],
        args: ['-c', '(uname -a;echo;' + lsblk + ')'],
        env: process.env,
        cwd: process.cwd(),
        cursorType: "block",
        border: "line",
        scrollback: 1000,
        mouse: true,
        style: {
            fg: "default", bg: "default",
            //border: { type: "line", fg: "blue" },
            focus: { border: { fg: "green" } },
            scrolling: { border: { fg: "red" } }
        }
    }

    let bxterm = new BXTERM(Object.assign({}, opts, {
        //args: ['-c', '(lsblk -Tp --output NAME,MAJ:MIN,UUID,SERIAL,STATE,TRAN,PTTYPE,TYPE,FSTYPE,LABEL,MOUNTPOINT,SIZE,FSUSED,FSUSE%,FSAVAIL,RO,RM,HOTPLUG | cut -c -' + (screen.width - 4) + ')'],
        //args: ['-c', '(lsblk -Tp --output NAME,MAJ:MIN,STATE,TRAN,PTTYPE,TYPE,FSTYPE,LABEL,MOUNTPOINT,SIZE,FSUSED,FSUSE%,FSAVAIL,RO,RM,HOTPLUG | cut -c -' + (screen.width - 4) + ')'],
        width: screen.width, height: 10,
        label: "[ Shell Output ]",
        border: { type: "line", fg: "blue" },
        controlKey: 'C-w'
    }));
    bxterm.flex = true;

    box.append(bxterm);
    screen.render();

    console.log(App.Disks.DB.Usages);

    App.BXTERM = bxterm;

    //bxterm.write("\n" + JSONFANCY(App.Disks.DB.Usages) + "\n");
    //bxterm.write(App.Disks.DB.Usages);
    //bxterm.write(JSON.stringify(App.Disks.DB.Usages));
    //bxterm.focus();

    //bxterm.write(JSONFANCY(App.Disks.DB.Usages).replace(/\n/g, "\n\r"));
    //bxterm.write("\n\r\n");

    return box;
}

App.TUI.FX.AppView = function () {
    //let box = blessed.box({ label: 'App Info', height: 8, bottom: 0, left: 0, border: { type: "line", fg: "blue" }, style: { fg: 'white', bg: 'green' } });
    //return box;
    let box = blessed.box({ height: 0, bottom: 0, left: 0, style: { fg: 'white', bg: 'red' } });
    return box;
}

//

App.InitArgs = function () {
    //App.Argy = yargs(process.argv);
}

App.InitInfo = function () {
    //App.SetInfo('App', function () { return 'DCLONE' });
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

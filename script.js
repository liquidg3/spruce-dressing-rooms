var ws281x = require('rpi-ws281x-native'),
    socketIO = require('socket.io'),
    TWEEN = require('tween.js'),
    HueApi = require("node-hue-api").HueApi,
    gpio = require("pi-gpio"),
    argv = require('argv'),
    args = argv.option([
        {
            name: 'room',
            type: 'string'
        }
    ]).run(),
    eastOrWest = args.targets[0] || 'west',
    lightNum = {
        west: 1,
        east: 2
    },
    lightState = {
        on: true,
        rgb: [0, 0, 0]
    };

var duration = 1000 * 60 * 10,
    toggleLights = null,
    hasTimedOut = false,
    isFirstCheckForMotion = true,
    num_lights = 144 * 4,
    brightness = 1,
    ipad = null;

ws281x.init(num_lights);

var last_rgbs = [],
    is_running = false,
    dirty;

var colors = {
    white: [[255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255]],
    beach: [[0, 0, 255], [255, 255, 255], [0, 0, 255], [255, 255, 255], [0, 0, 255], [255, 255, 255], [0, 0, 255]],
    sunset: [[255, 157, 55], [255, 157, 55], [255, 157, 55], [255, 157, 55], [233, 159, 174], [255, 157, 55], [255, 157, 55]],
    boardroom: [[254, 248, 255], [103, 152, 121], [153, 155, 142], [153, 155, 142], [103, 152, 121], [153, 155, 142], [153, 155, 142]],
    grain: [[239, 234, 130], [239, 234, 130], [239, 234, 130], [206, 222, 174], [254, 246, 183], [254, 246, 183], [254, 246, 183]],
    disco: [[162, 255, 255], [162, 255, 255], [162, 255, 255], [162, 255, 255], [162, 255, 255], [169, 25, 237], [169, 25, 237], [169, 25, 237], [255, 127, 254], [255, 127, 254], [255, 127, 254]]
};


var pixels = [],
    light;

function rgb2Int(r, g, b) {
    return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}

var hostname = "192.168.1.2";
var username = "3dc6fdb8380ffc9179c2827372f781b0";
var api = new HueApi(hostname, username);

lightState.rgb = [0, 255, 0];
api.setLightState(lightNum[eastOrWest], lightState);

var actions = {

    beach: function () {

        //fill(colors['beach']);
        fill(colors.white);
        console.log('beach');
        is_running = false;

    },

    sunset: function () {

        fill(colors['sunset']);
        is_running = false;

        console.log('sunset!');

    },

    grain: function () {

        fill(colors['grain']);
        is_running = false;
        console.log('grain!');

    },

    boardroom: function () {

        fill(colors['boardroom']);
        is_running = false;
        console.log('boardroom!');

    },

    white: function () {

        fill(colors['white']);
        is_running = false;
        console.log('white!');

    },

    black: function () {

        //turn strip off
        fill([[0, 0, 0]]);
        is_running = false;
        console.log('black!');

    },

    disco: function () {
        console.log('disco!');
        is_running = true;
    }

};


setInterval(function () {


    if (is_running) {

        fill(colors.disco, false);
        colors.disco.push(colors.disco.shift());
        dirty = true;

    } else {

        TWEEN.update();

    }

    if (dirty) {

        var factor = Math.ceil(num_lights / pixels.length);
        var p = new Uint32Array(num_lights),
            rgb = [];

        //console.log('factor22', factor, num_lights, pixels.length);
        //console.log('factor', factor);

        for (var c = 1; c <= factor; c++) {
            for (var x = 0; x < pixels.length; x++) {
                p[(x + 1) * c] = rgb2Int(pixels[x][0], pixels[x][1], pixels[x][2]);
                rgb.push(pixels[x]);
                //console.log('setting key', (x+1)*c, 'from', x, pixels[x]);
            }
        }

        last_rgbs = rgb;
        //console.log('rgb', rgb);


        ws281x.render(p);
        dirty = false;
    }


}, 10);

var hueTimeout = false,
    hueRunning = false,
    last_fill_rgb;


function fill(rgb_array, animate) {

    var j = 0;

    pixels = [];

    last_fill_rgb = rgb_array[0];

    if (hueTimeout) {
        clearTimeout(hueTimeout);
    }

    if (last_fill_rgb[0] === 0 && last_fill_rgb[1] === 0 && last_fill_rgb[2] === 0) {
        lightState.on = false;
    } else {
        lightState.on = true;
        lightState.rgb = last_fill_rgb;
    }

    if (!hueRunning) {

        hueRunning = true;
        api.setLightState(lightNum, lightState, function () {
            setTimeout(function () {
                hueRunning = false;
            }, 500)
        });


    } else {
        hueTimeout = setTimeout(function () {

            if (!hueRunning) {

                hueRunning = true;
                api.setLightState(lightNum, lightState, function () {
                    hueRunning = false;
                });

            }

        }, 1000);
    }


    for (var i = 0; i < rgb_array.length; i++) {

        var rgb_value = rgb_array[j],
            tween;

        if (animate !== false) {

            if (!last_rgbs[i]) {
                last_rgbs[i] = [0, 0, 0];
            }

            //console.log('from', i, last_rgbs[i][0], last_rgbs[i][1], last_rgbs[i][2]);
            //console.log('to', i, rgb_value[0], rgb_value[1], rgb_value[2]);

            tween = new TWEEN.Tween({
                r: last_rgbs[i][0] || 0,
                g: last_rgbs[i][1] || 0,
                b: last_rgbs[i][2] || 0
            }).to({
                    r: rgb_value[0] * brightness,
                    g: rgb_value[1] * brightness,
                    b: rgb_value[2] * brightness
                }, 1000)
                .onUpdate(function (i) {

                    return function () {

                        this.r = Math.min(255, Math.round(this.r));
                        this.g = Math.min(255, Math.round(this.g));
                        this.b = Math.min(255, Math.round(this.b));

                        //console.log('rgb:',i,this.r, this.g, this.b);
                        var rgb = [this.r, this.g, this.b];
                        pixels[i] = rgb;
                        dirty = true;

                    };
                }(i))
                .start();

            //.easing( TWEEN.Easing.Elastic.InOut)

        } else {
            pixels[i] = [rgb_value[0], rgb_value[1], rgb_value[2]];
            dirty = true;
        }

        j++;

        if (j >= rgb_array.length) j = 0;

    }

}

(function (socket) {

    //console.log('ready');
    //fill([[0, 255, 0]]);

    socket.on('connection', function (con) {

        ipad = con;

        fill([[0, 0, 0]]);

        con.on('touch', function () {

            console.log('TOUCHED! By and annnegggeeell!');

        });

        con.on('beach', function () {

            actions['beach']();

        });

        con.on('sunset', function () {

            actions['sunset']();


        });

        con.on('grain', function () {

            actions['grain']();
        });

        con.on('boardroom', function () {

            actions['boardroom']();

        });

        con.on('black', function () {

            actions['black']();


        });

        con.on('disco', function () {

            actions['disco']();

        });

    });

})(socketIO(8080));

function defaultScreen() {
    actions.white();
}

function checkForMotion() {

    gpio.read(11, function (err, value) {

        if (err) throw err;

        if (value === 1) {

            if (hasTimedOut) {
                isBack();
            }

            clearTime();
            toggleLights = setTimeout(timedOut, duration);
        }

    });

    if (isFirstCheckForMotion) {
        isFirstCheckForMotion = false;
        toggleLights = setTimeout(timedOut, duration);
    }

    setTimeout(checkForMotion, 1000);

}

function isBack() {

    hasTimedOut = false;

    console.log('did wakeup');
    if (ipad) {
        ipad.emit('did-wakeup');
    }
}

function clearTime() {
    hasTimedOut = false;
    clearTimeout(toggleLights);
}

function timedOut() {

    hasTimedOut = true;

    console.log('timed out');
    if (ipad) {
        ipad.emit('did-timeout');
    }

}

setTimeout(function () {

    defaultScreen();
    checkForMotion();

}, 2500);

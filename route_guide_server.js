const path = require('path');
const minimist = require('minimist');
const fs = require('fs');
const _ = require('lodash');

// grpc modules
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader')

const PROTO_PATH = path.resolve(__dirname + "/route_guide.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
})

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition).routeGuide;

const COORD_FACTOR = 1e7;

function checkFeature(point) {
    var feature;
    for (var i = 0; i < feature_list.length; i++) {
        feature = feature_list[i];
        if (feature.location.latitude === point.latitude &&
            feature.location.longitude === point.longitude) {
            return feature;
        }
    }

    feature = {
        name: '',
        location: point
    };
    return feature;
}

function getFeature(call, callback) {
    callback(null, checkFeature(call.request));
}

function listFeatures(call) {
    var lo = call.request.lo;
    var hi = call.request.hi;
    var left = _.min([lo.longitude, hi.longitude]);
    var right = _.max([lo.longitude, hi.longitude]);
    var top = _.max([lo.latitude, hi.latitude]);
    var bottom = _.min([lo.latitude, hi.latitude]);

    _.each(feature_list, function (feature) {
        if (feature.name === '') {
            return;
        }
        if (feature.location.longitude >= left &&
            feature.location.longitude <= right &&
            feature.location.latitude >= bottom &&
            feature.location.latitude <= top) {
            call.write(feature);
        }
    });
    call.end();
}

function getDistance(start, end) {
    function toRadians(num) {
        return num * Math.PI / 180;
    }
    var R = 6371000;  // earth radius in metres
    var lat1 = toRadians(start.latitude / COORD_FACTOR);
    var lat2 = toRadians(end.latitude / COORD_FACTOR);
    var lon1 = toRadians(start.longitude / COORD_FACTOR);
    var lon2 = toRadians(end.longitude / COORD_FACTOR);

    var deltalat = lat2 - lat1;
    var deltalon = lon2 - lon1;
    var a = Math.sin(deltalat / 2) * Math.sin(deltalat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(deltalon / 2) * Math.sin(deltalon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}


function recordRoute(call, callback) {
    var point_count = 0;
    var feature_count = 0;
    var distance = 0;
    var previous = null;
    // Start a timer
    var start_time = process.hrtime();
    call.on('data', function (point) {
        point_count += 1;
        if (checkFeature(point).name !== '') {
            feature_count += 1;
        }

        if (previous != null) {
            distance += getDistance(previous, point);
        }
        previous = point;
    });
    call.on('end', function () {
        callback(null, {
            point_count: point_count,
            feature_count: feature_count,
            // Cast the distance to an integer
            distance: distance | 0,
            // End the timer
            elapsed_time: process.hrtime(start_time)[0]
        });
    });
}

function getServer() {
    const server = new grpc.Server()

    server.addService(protoDescriptor.RouteGuide.service, {
        getFeature, listFeatures, recordRoute
    })

    return server
}

if (require.main === module) {

    const server = getServer();
    server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {

        const db_path = path.join(__dirname, 'db.json')

        const argv = minimist(process.argv, {
            path: db_path,
        });

        fs.readFile(path.resolve(argv.db_path), function (err, data) {
            if (err) throw err;
            feature_list = JSON.parse(data);
            server.start();
        });
    });
};

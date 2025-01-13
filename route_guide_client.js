const async = require('async');
const fs = require('fs');
const parseArgs = require('minimist');
const path = require('path');
const _ = require('lodash');
const grpc = require('@grpc/grpc-js');

const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.resolve(__dirname + '/route_guide.proto');

const packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });

const routeGuide = grpc.loadPackageDefinition(packageDefinition).routeGuide;

const client = new routeGuide.RouteGuide('localhost:50051', grpc.credentials.createInsecure())

const COORD_FACTOR = 1e7;

function runGetFeature(callback) {
    var next = _.after(2, callback);
    function featureCallback(error, feature) {
        if (error) {
            callback(error);
            return;
        }
        if (feature.name === '') {
            console.log('Found no feature at ' +
                feature.location.latitude / COORD_FACTOR + ', ' +
                feature.location.longitude / COORD_FACTOR);
        } else {
            console.log('Found feature called "' + feature.name + '" at ' +
                feature.location.latitude / COORD_FACTOR + ', ' +
                feature.location.longitude / COORD_FACTOR);
        }
        next();
    }
    var point1 = {
        latitude: 408122808,
        longitude: -743999179
    };
    var point2 = {
        latitude: 0,
        longitude: 0
    };
    client.getFeature(point1, featureCallback);
    client.getFeature(point2, featureCallback);
}

function runListFeatures(callback) {
    var rectangle = {
        lo: {
            latitude: 400000000,
            longitude: -750000000
        },
        hi: {
            latitude: 420000000,
            longitude: -730000000
        }
    };

    var call = client.listFeatures(rectangle);

    call.on('data', function (feature) {
        console.log('Found feature called "' + feature.name + '" at ' +
            feature.location.latitude / COORD_FACTOR + ', ' +
            feature.location.longitude / COORD_FACTOR);
    });
    call.on('end', callback);
}

function runRecordRoute(callback) {
    var argv = parseArgs(process.argv, {
        string: 'db_path'
    });

    fs.readFile(path.resolve(__dirname + "/db.json"), function (err, data) {
        if (err) {
            console.log(err);
            callback(err);
            return;
        }

        var feature_list = JSON.parse(data);

        console.log("VARIABLE feature_list: ", feature_list)

        var num_points = 10;
        var call = client.recordRoute(function (error, stats) {
            if (error) {
                callback(error);
                return;
            }
            console.log('Finished trip with', stats.point_count, 'points');
            console.log('Passed', stats.feature_count, 'features');
            console.log('Travelled', stats.distance, 'meters');
            console.log('It took', stats.elapsed_time, 'seconds');
            callback();
        });

        function pointSender(lat, lng) {
            return function (callback) {
                console.log('Visiting point ' + lat / COORD_FACTOR + ', ' +
                    lng / COORD_FACTOR);
                call.write({
                    latitude: lat,
                    longitude: lng
                });
                _.delay(callback, _.random(500, 1500));
            };
        }
        var point_senders = [];
        for (var i = 0; i < num_points; i++) {
            var rand_point = feature_list[_.random(0, feature_list.length - 1)];
            point_senders[i] = pointSender(rand_point.location.latitude,
                rand_point.location.longitude);
        }
        async.series(point_senders, function () {
            call.end();
        });
    });
}

function main() {
    async.series([
        // runGetFeature, 
        // runListFeatures,
        runRecordRoute
    ]);
}

if (require.main === module) {
    main();
}
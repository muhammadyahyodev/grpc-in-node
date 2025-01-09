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


function main() {
    async.series([
        runGetFeature,
    ]);
}

if (require.main === module) {
    main();
}
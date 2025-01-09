const path = require('path');
const minimist = require('minimist');
const fs = require('fs');

// grpc modules
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader')

const PROTO_PATH = path.resolve(__dirname + "/route_guide.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
})

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition).routeGuide;

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

function getServer() {
    const server = new grpc.Server()

    server.addService(protoDescriptor.RouteGuide.service, {
        getFeature
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

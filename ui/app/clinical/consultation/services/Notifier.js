'use strict';

Bahmni.Clinical.Notifier = function () {
    var callBacks = {};
    this.register = function (key, callback) {
        callBacks[key] = callback;
    };

    this.unregister = function (key) {
        delete callBacks[key];
    };

    this.fire = function () {
        _.each(callBacks, function (callback) {
            callback();
        });
    };
};

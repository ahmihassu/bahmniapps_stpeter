'use strict';

angular.module('bahmni.clinical')
    .service('clinicalAppointmentHolidayConfig', ['appService', function (appService) {
        var self = this;

        this.load = function () {
            return appService.loadConfig('holidays.csv').then(function (response) {
                return response;
            });
        };
    }]);

'use strict';

angular.module('bahmni.clinical').factory('appointmentServiceInitialization',
    ['appointmentsServiceService',
        function (appointmentsServiceService) {
            return function (serviceUuid) {
                var getAppointmentService = function () {
                    if (serviceUuid !== 'new') {
                        return appointmentsServiceService.getService(serviceUuid).then(function (response) {
                            return {service: response.data};
                        });
                    }
                };

                return getAppointmentService();
            };
        }]
);

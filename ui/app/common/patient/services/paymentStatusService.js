'use strict';

angular.module('bahmni.common.patient')
    .service('paymentStatusService', ['$http', function ($http) {
        this.getPaymentStatus = function (externalId) {
            return $http.get(`/openmrs/ws/rest/v1/bahmnicore/paymentstatus?externalId=${externalId}`, {
                withCredentials: true
            });
        };
    }]);

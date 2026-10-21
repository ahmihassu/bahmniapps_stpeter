'use strict';

angular.module('bahmni.clinical')
    .service('appointmentsService', ['$http', 'appService',
        function ($http, appService) {
            this.save = function (appointment) {
                return $http.post(Bahmni.Clinical.Constants.createAppointmentUrl, appointment, {
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };
            this.search = function (appointment) {
                return $http.post(Bahmni.Clinical.Constants.searchAppointmentUrl, appointment, {
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.getAppointmentsForServiceType = function (serviceTypeUuid) {
                var params = {"appointmentServiceTypeUuid": serviceTypeUuid};
                return $http.get(Bahmni.Clinical.Constants.getAppointmentsForServiceTypeUrl, {
                    params: params,
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.searchAppointments = function (data) {
                return $http.post(Bahmni.Clinical.Constants.searchAppointmentsUrl, data, {
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.getAllAppointments = function (params) {
                return $http.get(Bahmni.Clinical.Constants.getAllAppointmentsUrl, {
                    params: params,
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.getAppointmentByUuid = function (appointmentUuid) {
                var params = {uuid: appointmentUuid};
                return $http.get(Bahmni.Clinical.Constants.getAppointmentByUuid, {
                    params: params,
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.getAppointmentsSummary = function (params) {
                return $http.get(Bahmni.Clinical.Constants.getAppointmentsSummaryUrl, {
                    params: params,
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.changeStatus = function (appointmentUuid, toStatus, onDate) {
                var params = {toStatus: toStatus, onDate: onDate};
                var changeStatusUrl = appService.getAppDescriptor().formatUrl(Bahmni.Clinical.Constants.changeAppointmentStatusUrl, {appointmentUuid: appointmentUuid});
                return $http.post(changeStatusUrl, params, {
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };
        }]);

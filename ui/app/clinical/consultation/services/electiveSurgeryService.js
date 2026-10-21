'use strict';
angular.module('bahmni.common.domain')
    .service('electiveSurgeryService', ['$http', '$q', function ($http, $q) {
        // the end point for the api is set in bahmni advanced settings, because it changez from server to server
        var getAPI = function () {
            var params = {
                q: "es_endpoint_getter",
            };
            return $http.get(Bahmni.Common.Constants.sqlUrl, {
                method: "GET",
                params: params,
                withCredentials: true
            }).then(response => {
                if (response.data[0].property_value) {
                    return response.data[0].property_value;
                }
                throw new Error("Failed to fetch the elective surgery API endpoint.");
            });
        };
        this.getProcedures = function () {
            return getAPI().then(endpoint => {
                return $http.get(`${endpoint}procedure?page=1&limit=10000`);
            });
        };
        this.getCatagories = function () {
            return getAPI().then(endpoint => {
                return $http.get(`${endpoint}category`);
            });
        };
        this.createAppointment = function (params) {
            return getAPI().then(endpoint => {
                return $http.post(`${endpoint}patient`, params);
            });
        };

        this.updateAnesthesiaStatus = function (params, appointmentId) {
            return getAPI().then(endpoint => {
                return $http.put(`${endpoint}appointment/${appointmentId}`, params);
            });
        }
        
    }]);
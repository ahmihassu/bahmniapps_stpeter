'use strict';

angular.module('bahmni.clinical')
    .service('specialityService', ['$http',
        function ($http) {
            this.getAllSpecialities = function () {
                return $http.get(Bahmni.Clinical.Constants.getAllSpecialitiesUrl, {
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };
        }]);


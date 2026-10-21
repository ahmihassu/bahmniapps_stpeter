'use strict';

angular.module('bahmni.adt')
    .controller('WardsController', ['$scope','$bahmniCookieStore','$rootScope', '$window', '$document', 'spinner', 'wardService',
        function ($scope, $bahmniCookieStore, $rootScope, $window, $document, spinner, wardService) {
            $scope.wards = null;
            $scope.message = "";
            var init = function () {
                return loadAllWards();
            };
            var loginLocationName = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).name;
            var loadAllWards = function () {
                return wardService.getWardsList().success(function (wardsList) {
                    $scope.wards = wardsList.results.filter(function (ward) {
                        return ward.ward.name === loginLocationName;
                    });
                    if ($scope.wards.length === 0) {
                        $scope.message = "This is not a ward location. Please change Login Location"
                    }
                });
            };

            spinner.forPromise(init());
        }]);

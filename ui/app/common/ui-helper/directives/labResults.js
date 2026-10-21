'use strict';
angular.module('bahmni.common.uiHelper')
.directive('labResults', [ function () {
    var controller = function ( $scope, $window, $http, $bahmniCookieStore) {
        var initialize = function () {
            $scope.showNotifications = false;
            getLabResults();
            getRadResults();
        };
      
        $scope.toggleNotifications = function () {
            $scope.showNotifications = !$scope.showNotifications;
        };
        $scope.goToDashboard = function (patientUuid) {
            var url = '../clinical/#/default/patient/' + patientUuid + '/dashboard';
            $window.location.href = url;
        };
        var getLabResults = function () {
            var params = {
                q: "emrapi.sqlSearch.labResultNotification",
                location_uuid: $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid,
            };
            var promise = $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
            promise.then(function (result) {
                $scope.numOfNotifications = result.data.length;
                $scope.labResults = result.data;                
            });
        };
        var getRadResults = function () {
            var params = {
                q: "emrapi.sqlSearch.radResultNotification",
                location_uuid: $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid,
            };
            var promise = $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
            promise.then(function (result) {
                $scope.numOfNotifications += result.data.length;
                $scope.radiologyResults = result.data;                
            });
        };
        initialize();
    };
    return {
        restrict: 'E',
        controller: controller,
        template: '<div class="fl notification-wrapper">' +
                       ' <div>' + 
                           ' <a ng-click="toggleNotifications()">' +
                               ' <div class="notifications-icon">' +
                                    '<i class="fa fa-bell" style="font-size:25px;color:white"></i>' +
                                    '<span ng-if="numOfNotifications > 0" class="notifications-badge">{{numOfNotifications}}</span>' +
                               ' </div>' + 
                           ' </a>' +
                       ' </div>' +
    
                       ' <ul style="overflow-y: scroll; max-height:300px;" ng-if="showNotifications">' + 
                           ' <a ng-repeat="notification in labResults">' +
                                '<li ng-href="../clinical/#/default/patient/{{patient.uuid}}/dashboard" ng-click="goToDashboard(notification.uuid)">' +
                                   ' <p>' +
                                        'Patient {{notification.name}} (MRU: {{notification.identifier}}) has a lab result' +
                                   ' </p> ' + 
                                '</li>' +
                           ' </a>' + 
                           ' <a ng-repeat="notification in radiologyResults">' +
                                '<li ng-href="../clinical/#/default/patient/{{patient.uuid}}/dashboard" ng-click="goToDashboard(notification.uuid)">' +
                                   ' <p>' +
                                        'Patient {{notification.name}} (MRU: {{notification.identifier}}) has a radiology result' +
                                   ' </p> ' + 
                                '</li>' +
                           ' </a>' + 
                        '</ul>' +
                     '</div>'
    };
}]);
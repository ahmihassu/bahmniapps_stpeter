'use strict';

angular.module('bahmni.common.obs')
    .directive('showObservation', ['ngDialog', '$sce', function (ngDialog, $sce) {
        var controller = function ($scope, $rootScope, $filter) {
            $scope.toggle = function (observation) {
                observation.showDetails = !observation.showDetails;
            };

            $scope.print = $rootScope.isBeingPrinted || false;

            $scope.dateString = function (observation) {
                var filterName;
                if ($scope.showDate && $scope.showTime) {
                    filterName = 'bahmniDateTime';
                } else if (!$scope.showDate && ($scope.showTime || $scope.showTime === undefined)) {
                    filterName = 'bahmniTime';
                } else {
                    return null;
                }
                return $filter(filterName)(observation.observationDateTime);
            };

            $scope.convertTime = function (observation) {
                var date  = new Date().toString().slice(0, 16);
                var time = moment(date + observation.value).add(3,'h').format("hh:mm A");
                return time;
            }


            $scope.openVideoInPopup = function (observation) {
                ngDialog.open({
                    template: "../common/obs/views/showVideo.html",
                    closeByDocument: false,
                    className: 'ngdialog-theme-default',
                    showClose: true,
                    data: {
                        observation: observation
                    }
                });
            };
            $scope.formatTextValue = function(value) {
                var formattedValue = value.replace(/\n/g, '<br>');
                return $sce.trustAsHtml(formattedValue);
            };
            $scope.formatConsultValue = function(value) {
                if (value.includes("valueOne")){
                    var obj = JSON.parse(value); 
                    let smthn = `Consultation Request Note: ${obj.valueOne}<br>Consultation Response Note: ${obj.valueTwo?obj.valueTwo:""}<br>`
                    var formattedValue = smthn.replace(/\n/g, '<br>');
                    return $sce.trustAsHtml(formattedValue);
                    }
                else $scope.formatTextValue(value);
                };
        };
        return {
            restrict: 'E',
            scope: {
                observation: "=?",
                patient: "=",
                showDate: "=?",
                showTime: "=?",
                showDetailsButton: "=?",
                visitUuid: '=?',
                rootObservation: "=?"
            },
            controller: controller,
            template: '<ng-include src="\'../common/obs/views/showObservation.html\'" />'
        };
    }]);

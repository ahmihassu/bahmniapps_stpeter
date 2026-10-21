'use strict';

angular.module('bahmni.common.uiHelper')
    .directive('timepicker', function () {
        var link = function ($scope) {
            var getSelectedTimeStr = function () {
                return $scope.selectedTime != null ? moment($scope.selectedTime).format("HH:mm") : "";
            };
            var valueNotFilled = function () {
                return $scope.selectedTime == null;
            };

            var valueCompletelyFilled = function () {
                return $scope.selectedTime != null;
            };

            $scope.updateModel = function () {            
                if (valueCompletelyFilled()) {
                    $scope.model = getSelectedTimeStr();
                } else if (!$scope.isValid()) {
                    $scope.model = "Invalid Time";
                } else {
                    $scope.model = "";
                }
            };

            $scope.isValid = function () {
                return valueNotFilled() || valueCompletelyFilled();
            };

            if ($scope.model) {
                var date = moment("1970-01-01 "+$scope.model).toDate();
                $scope.selectedDate = date;
                $scope.selectedTime = date;
                $scope.updateModel();
            }
        };

        return {
            restrict: 'E',
            link: link,
            scope: {
                model: '=',
                observation: "=",
                showTime: '=',
                illegalValue: '=',
                allowFutureDates: '='
            },
            template:
                "<div>" +
                    "<input type='time' ng-change='updateModel()' ng-class= \"{'illegalValue': !isValid()}\" ng-model='selectedTime' ng-disabled='observation.disabled' />" +
                "</div>"
        };
    });

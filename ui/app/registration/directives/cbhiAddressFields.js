'use strict';

angular.module('bahmni.registration')
    .directive('cbhiAddressFields', function () {
        return {
            restrict: 'E',
            templateUrl: 'views/cbhiAddressFields.html',
            controller: 'cbhiAddressFieldsDirectiveController',
            scope: {
                // You can add any bindings you need here
            }
        };
    })
    .controller('cbhiAddressFieldsDirectiveController', ['$scope', '$rootScope', 'appService', function ($scope, $rootScope, appService) {
        $scope.options1 = [];
        $scope.filteredOptions2 = [];
        $scope.filteredOptions3 = [];
        $scope.selectedField1 = null;
        $scope.selectedField2 = null;
        $scope.selectedField3 = null;
        
        var addressData = [];

        var init = function () {
            loadAddressData();
        };

        function loadAddressData() {
            appService.loadCsvFileFromConfig('cbhi_address.csv').then(function(data) {
                var rows = data.data.split('\n');
                var headers = rows[0].split(',');

                for (var i = 1; i < rows.length; i++) {
                    var values = rows[i].split(',');
                    if (values.length === headers.length) {
                        var obj = {};
                        for (var j = 0; j < values.length; j++) {
                            obj[headers[j]] = values[j];
                        }
                        addressData.push(obj);
                    }
                }
                $scope.options1 = getUniqueValues(addressData, 'field1');
            });
        }

        $scope.onField1Change = function() {
            $rootScope.selectedField1 = $scope.selectedField1;
            $scope.filteredOptions2 = getFilteredUniqueValues(addressData, 'field2', 'field1', $scope.selectedField1.field1);
            $scope.selectedField2 = null;
            $scope.selectedField3 = null;
        };

        $scope.onField2Change = function() {
            $rootScope.selectedField2 = $scope.selectedField2;
            $scope.filteredOptions3 = getFilteredUniqueValues(addressData, 'field3', 'field2', $scope.selectedField2.field2);
            $scope.selectedField3 = null;
        };

        $scope.onField3Change = function() {
            $rootScope.selectedField3 = $scope.selectedField3;
        };

        function getUniqueValues(data, columnName) {
            var uniqueValues = [];
            var seenValues = {};
            for (var i = 0; i < data.length; i++) {
                var value = data[i][columnName];
                if (!seenValues[value]) {
                    seenValues[value] = true;
                    uniqueValues.push({ [columnName]: value });
                }
            }
            return uniqueValues;
        }

        function getFilteredUniqueValues(data, columnName, filterColumn, filterValue) {
            var filteredData = data.filter(function(item) {
                return item[filterColumn] === filterValue;
            });
            var uniqueValues = [];
            var seenValues = {};
            for (var i = 0; i < filteredData.length; i++) {
                var value = filteredData[i][columnName];
                if (!seenValues[value]) {
                    seenValues[value] = true;
                    uniqueValues.push({ [columnName]: value });
                }
            }
            return uniqueValues;
        }

        init();
    }]);
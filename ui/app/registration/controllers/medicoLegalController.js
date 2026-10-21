'use strict';

angular.module('bahmni.registration')
    .controller('MedicoLegalController', ['$http','$rootScope', '$scope', '$location', '$window', 'spinner', 'patientService', 'appService',
        'messagingService', '$translate', '$filter', '$bahmniCookieStore',  'encounterService',  'visitService', 'auditLogService' , 'ngDialog',
        function ($http,$rootScope, $scope, $location, $window, spinner, patientService, appService, messagingService, $translate, $filter ,$bahmniCookieStore ,  encounterService, visitService, auditLogService, ngDialog) {
            $scope.results = [];
            $scope.extraIdentifierTypes = _.filter($rootScope.patientConfiguration.identifierTypes, function (identifierType) {
                return !identifierType.primary;
            });
            $scope.searchParameters = {};
            var execSearchQuery = function () {
                var params = {
                    q: "searchMedicoLegal",
                    given_name: $scope.searchParameters.firstName || "",
                    middle_name: $scope.searchParameters.fatherName || "",
                    family_name: $scope.searchParameters.grandFatherName || "",
                    pid: $scope.searchParameters.registrationNumber || ""
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            var getAllFor = function (searchTerm) {
                var url = Bahmni.Common.Constants.emrapiConceptUrl;
                var parameters = {term: searchTerm, limit: 5};
                return $http.get(url, {
                    params: parameters
                });
            };
            $scope.refreshList = function(){
                getAllFor($scope.searchParameters.diagnosis).then(x => $scope.diagnosisList = x.data)
            }
            
            var searching = false;
            var maxAttributesFromConfig = 5;
            var allSearchConfigs = appService.getAppDescriptor().getConfigValue("patientSearch") || {};
            var patientSearchResultConfigs = appService.getAppDescriptor().getConfigValue("patientSearchResults") || {};
            maxAttributesFromConfig = !_.isEmpty(allSearchConfigs.programAttributes) ? maxAttributesFromConfig - 1 : maxAttributesFromConfig;

            var visitType = visitService.getVisitType();

            visitType.then(function (data){
                    $scope.visitType=data.data.results;
            })
            
            $scope.getAddressColumnName = function (column) {
                var columnName = "";
                var columnCamelCase = column.replace(/([-_][a-z])/g, function ($1) {
                    return $1.toUpperCase().replace(/[-_]/, '');
                });
                _.each($scope.addressLevels, function (addressLevel) {
                    if (addressLevel.addressField === columnCamelCase) { columnName = addressLevel.name; }
                });
                return columnName;
            };


            var searchBasedOnQueryParameters = function (offset) {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }
            };
            $scope.convertToTableHeader = function (camelCasedText) {
                return $translate.instant(camelCasedText).replace(/[A-Z]|^[a-z]/g, function (str) {
                    return " " + str.toUpperCase() + "";
                }).trim();
            };

            $scope.getProgramAttributeValues = function (result) {
                var attributeValues = result && result.patientProgramAttributeValue && result.patientProgramAttributeValue[$scope.programAttributesSearchConfig.field];
                var commaSeparatedAttributeValues = "";
                _.each(attributeValues, function (attr) {
                    commaSeparatedAttributeValues = commaSeparatedAttributeValues + attr + ", ";
                });
                return commaSeparatedAttributeValues.substring(0, commaSeparatedAttributeValues.length - 2);
            };

            
            var showSearchResults = function (searchPromise) {
                $scope.noMoreResultsPresent = false;
                if (searchPromise) {
                    searchPromise.then(function (data) {
                        $scope.results = data.pageOfResults;
                        $scope.noResultsMessage = $scope.results.length === 0 ? 'REGISTRATION_NO_RESULTS_FOUND' : null;
                        if($scope.results.length != 0)
                            $scope.results.sort(compare);
                    });
                }
            };

            function compare(a, b) {
                // Use toUpperCase() to ignore character casing
                const givenNameA = a.givenName.toUpperCase();
                const givenNameB = b.givenName.toUpperCase();

                let comparison = 0;
                if (givenNameA > givenNameB) {
                  comparison = 1;
                } else if (givenNameA < givenNameB) {
                  comparison = -1;
                }
                return comparison;
            }

            var setPatientIdentifierSearchConfig = function () {
                $scope.patientIdentifierSearchConfig = {};
                $scope.patientIdentifierSearchConfig.show = allSearchConfigs.searchByPatientIdentifier === undefined ? true : allSearchConfigs.searchByPatientIdentifier;
            };

            var setAddressSearchConfig = function () {
                $scope.addressSearchConfig = allSearchConfigs.address || {};
                $scope.addressSearchConfig.show = !_.isEmpty($scope.addressSearchConfig) && !_.isEmpty($scope.addressSearchConfig.field);
                if ($scope.addressSearchConfig.label && !$scope.addressSearchConfig.label) {
                    throw new Error("Search Config label is not present!");
                }
                if ($scope.addressSearchConfig.field && !$scope.addressSearchConfig.field) {
                    throw new Error("Search Config field is not present!");
                }
            };

            var setCustomAttributesSearchConfig = function () {
                var customAttributesSearchConfig = allSearchConfigs.customAttributes;
                $scope.customAttributesSearchConfig = customAttributesSearchConfig || {};
                $scope.customAttributesSearchConfig.show = !_.isEmpty(customAttributesSearchConfig) && !_.isEmpty(customAttributesSearchConfig.fields);
            };

            var setProgramAttributesSearchConfig = function () {
                $scope.programAttributesSearchConfig = allSearchConfigs.programAttributes || {};
                $scope.programAttributesSearchConfig.show = !_.isEmpty($scope.programAttributesSearchConfig.field);
            };

            var sliceExtraColumns = function () {
                var orderedColumns = Object.keys(patientSearchResultConfigs);
                _.each(orderedColumns, function (column) {
                    if (patientSearchResultConfigs[column].fields && !_.isEmpty(patientSearchResultConfigs[column].fields)) {
                        patientSearchResultConfigs[column].fields = patientSearchResultConfigs[column].fields.slice(patientSearchResultConfigs[column].fields, maxAttributesFromConfig);
                        maxAttributesFromConfig -= patientSearchResultConfigs[column].fields.length;
                    }
                });
            };

            var setSearchResultsConfig = function () {
                var resultsConfigNotFound = false;
                if (_.isEmpty(patientSearchResultConfigs)) {
                    resultsConfigNotFound = true;
                    patientSearchResultConfigs.address = {"fields": allSearchConfigs.address ? [allSearchConfigs.address.field] : {}};
                    patientSearchResultConfigs.personAttributes
                        = {fields: allSearchConfigs.customAttributes ? allSearchConfigs.customAttributes.fields : {}};
                } else {
                    if (!patientSearchResultConfigs.address) patientSearchResultConfigs.address = {};
                    if (!patientSearchResultConfigs.personAttributes) patientSearchResultConfigs.personAttributes = {};
                }

                if (patientSearchResultConfigs.address.fields && !_.isEmpty(patientSearchResultConfigs.address.fields)) {
                    patientSearchResultConfigs.address.fields =
                        patientSearchResultConfigs.address.fields.filter(function (item) {
                            return !_.isEmpty($scope.getAddressColumnName(item));
                        });
                }
                if (!resultsConfigNotFound) sliceExtraColumns();
                $scope.personSearchResultsConfig = patientSearchResultConfigs.personAttributes;
                $scope.addressSearchResultsConfig = patientSearchResultConfigs.address;
            };

            var initialize = function () {
                $scope.searchParameters = {};
                $scope.searchActions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.patient.search.result.action");
                setPatientIdentifierSearchConfig();
                setAddressSearchConfig();
                setCustomAttributesSearchConfig();
                setProgramAttributesSearchConfig();
                setSearchResultsConfig();
            };

            initialize();


            $scope.$watch(function () {
                return $location.search();
            }, function () {
                showSearchResults(searchBasedOnQueryParameters(0));
            });

            var isUserPrivilegedForSearch = function () {
                var applicablePrivs = [Bahmni.Common.Constants.viewPatientsPrivilege, Bahmni.Common.Constants.editPatientsPrivilege,
                    Bahmni.Common.Constants.addVisitsPrivilege, Bahmni.Common.Constants.deleteVisitsPrivilege];
                var userPrivs = _.map($rootScope.currentUser.privileges, function (privilege) {
                    return privilege.name;
                });
                var result = _.some(userPrivs, function (privName) {
                    return _.includes(applicablePrivs, privName);
                });
                return result;
            };

            var showInsufficientPrivMessage = function () {
                var message = $translate.instant("REGISTRATION_INSUFFICIENT_PRIVILEGE");
                messagingService.showMessage('error', message);
            };

            $scope.loadingMoreResults = function () {
                return searching && !$scope.noMoreResultsPresent;
            };

            $scope.searchPatients = function () {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }
                $scope.results = [];
                return spinner.forPromise(execSearchQuery()).then(x => $scope.results = x.data);
            };

            $scope.resultsPresent = function () {
                return angular.isDefined($scope.results) && $scope.results.length > 0;
            };

            $scope.editPatientUrl = function (url, options) {
                var temp = url;
                for (var key in options) {
                    temp = temp.replace("{{" + key + "}}", options[key]);
                }
                return temp;
            };

            $scope.nextPage = function () {
                if ($scope.nextPageLoading) {
                    return;
                }
                $scope.nextPageLoading = true;
                var promise = searchBasedOnQueryParameters($scope.results.length);
                if (promise) {
                    promise.then(function (data) {
                        angular.forEach(data.pageOfResults, function (result) {
                            $scope.results.push(result);
                        });
                        $scope.noMoreResultsPresent = (data.pageOfResults.length === 0);
                        $scope.nextPageLoading = false;
                    }, function () {
                        $scope.nextPageLoading = false;
                    });
                }
            };

            $scope.forPatient = function (patient) {
                $scope.selectedPatient = patient;
                return $scope;
            };

            $scope.doExtensionAction = function (extension) {
                //$location.url(forwardTo);
            };

            $scope.extensionActionText = function (extension) {
                return $filter('titleTranslate')(extension);
            };

            $scope.isExtraIdentifierConfigured = function () {
                return !_.isEmpty($scope.extraIdentifierTypes);
            };
                    }]);
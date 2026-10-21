'use strict';

angular.module('bahmni.registration')
    .controller('SearchPatientController', ['$http', '$rootScope', '$scope', '$location', '$window', 'spinner', 'patientService', 'appService',
        'messagingService', '$translate', '$filter', '$bahmniCookieStore', 'encounterService', 'visitService', 'bedService', 'auditLogService', 'ngDialog', 'locationService', 'queueService',
        function ($http, $rootScope, $scope, $location, $window, spinner, patientService, appService, messagingService, $translate, $filter, $bahmniCookieStore, encounterService, visitService, bedService, auditLogService, ngDialog, locationService, queueService) {
            $scope.results = [];
            $scope.queueCallPending = false;
            $scope.queueCardVisible = false;
            $scope.queueCurrentServing = '—';
            $scope.skippedTickets = [];

            $scope.loadSkippedTickets = function () {
                var locationName = $location.url().includes("from=gynecology") ? "Gynecology Triage" : $location.url().includes("from=pediatric") ? "Pediatric Triage" : "Central Triage";
                queueService.getSkippedTickets(locationName)
                    .then(function (tickets) {
                        $scope.skippedTickets = tickets || [];
                    })
                    .catch(function () {
                        $scope.skippedTickets = [];
                    });
            };

            $scope.callNextTicket = function (location) {
                var locationName = location ? location : $location.url().includes("from=gynecology") ? "Gynecology Triage" : $location.url().includes("from=pediatric") ? "Pediatric Triage" : "Central Triage";   
                if ($scope.queueCallPending) return;
                $scope.queueCallPending = true;
                queueService.callNext(locationName)
                    .then(function (data) {
                        if (data && data.ticketNumber != null) {
                            $scope.queueCurrentServing = data.ticketNumber;
                        }
                    })
                    .catch(function (err) {
                        var msg = (err.data && err.data.message) ? err.data.message : (err.statusText || "Request failed");
                        if (err.status === 404) {
                            msg = "Location not found (id " + queueService.getQueueLocationId() + "). Create a location in QueueSmart or set queueLocationId to an existing location ID.";
                        }
                    })
                    .finally(function () {
                        $scope.queueCallPending = false;
                    });
            };
            
            $scope.setCurrentFromSkipped = function (ticketNumber) {
                // Just update the local/current and persisted values; do not change the server queue
                $scope.queueCurrentServing = ticketNumber;
                queueService.setPersistedCurrentServing(ticketNumber);
            };
            $scope.extraIdentifierTypes = _.filter($rootScope.patientConfiguration.identifierTypes, function (identifierType) {
                return !identifierType.primary;
            });
            var searching = false;
            var maxAttributesFromConfig = 5;
            var allSearchConfigs = appService.getAppDescriptor().getConfigValue("patientSearch") || {};
            var patientSearchResultConfigs = appService.getAppDescriptor().getConfigValue("patientSearchResults") || {};
            var erTriageVisitTypes = appService.getAppDescriptor().getConfigValue("erTriageVisitTypes")
            var erPediTriageVisitTypes = appService.getAppDescriptor().getConfigValue("erPediTriageVisitTypes");
            maxAttributesFromConfig = !_.isEmpty(allSearchConfigs.programAttributes) ? maxAttributesFromConfig - 1 : maxAttributesFromConfig;
            if ($rootScope.fromPediatric || $location.url().includes("from=pediatric")) {
                $rootScope.fromPediatric = true;
                $scope.prTriageVisitTypes = appService.getAppDescriptor().getConfigValue("prTriageVisitTypes")
            }
            if ($rootScope.crSearchTwo || $location.url().includes("two")) {
                $rootScope.crSearchTwo = true
            }
            if ($rootScope.fromToxicology || $location.url().includes("from=toxicology")) {
                $rootScope.fromToxicology = true;
            }
            if ($rootScope.fromGynecology || $location.url().includes("from=gynecology")) {
                $rootScope.fromGynecology = true;
            }
            if ($location.url().includes("erPediSearch")) {
                $rootScope.fromPediER = true;
            }
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

            var hasSearchParameters = function () {
                return $scope.searchParameters.name.trim().length > 0 ||
                    $scope.searchParameters.addressFieldValue.trim().length > 0 ||
                    $scope.searchParameters.customAttribute.trim().length > 0 ||
                    $scope.searchParameters.programAttributeFieldValue.trim().length > 0;
            };

            var searchBasedOnQueryParameters = function (offset) {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }
                var searchParameters = $location.search();
                $scope.searchParameters.addressFieldValue = searchParameters.addressFieldValue || '';
                $scope.searchParameters.name = searchParameters.name || '';
                $scope.searchParameters.customAttribute = searchParameters.customAttribute || '';
                $scope.searchParameters.programAttributeFieldValue = searchParameters.programAttributeFieldValue || '';
                $scope.searchParameters.addressSearchResultsConfig = searchParameters.addressSearchResultsConfig || '';
                $scope.searchParameters.personSearchResultsConfig = searchParameters.personSearchResultsConfig || '';

                $scope.searchParameters.registrationNumber = searchParameters.registrationNumber || "";
                if (hasSearchParameters()) {
                    searching = true;
                    var searchPromise = patientService.search(
                        $scope.searchParameters.name,
                        undefined,
                        $scope.addressSearchConfig.field,
                        $scope.searchParameters.addressFieldValue,
                        $scope.searchParameters.customAttribute,
                        offset,
                        $scope.customAttributesSearchConfig.fields,
                        $scope.programAttributesSearchConfig.field,
                        $scope.searchParameters.programAttributeFieldValue,
                        $scope.addressSearchResultsConfig.fields,
                        $scope.personSearchResultsConfig.fields
                    ).then(function (response) {
                        mapExtraIdentifiers(response);
                        mapCustomAttributesSearchResults(response);
                        mapAddressAttributesSearchResults(response);
                        mapProgramAttributesSearchResults(response);
                        return response;
                    });
                    searchPromise['finally'](function () {
                        searching = false;
                    });
                    return searchPromise;
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

            var mapExtraIdentifiers = function (data) {
                if (data !== "Searching") {
                    _.each(data.pageOfResults, function (result) {
                        result.extraIdentifiers = result.extraIdentifiers && JSON.parse(result.extraIdentifiers);
                    });
                }
            };

            var mapCustomAttributesSearchResults = function (data) {
                if (($scope.personSearchResultsConfig.fields) && data !== "Searching") {
                    _.map(data.pageOfResults, function (result) {
                        result.customAttribute = result.customAttribute && JSON.parse(result.customAttribute);
                    });
                }
            };

            var mapAddressAttributesSearchResults = function (data) {
                if (($scope.addressSearchResultsConfig.fields) && data !== "Searching") {
                    _.map(data.pageOfResults, function (result) {
                        try {
                            result.addressFieldValue = JSON.parse(result.addressFieldValue);
                        } catch (e) {
                        }
                    });
                }
            };

            var mapProgramAttributesSearchResults = function (data) {
                if (($scope.programAttributesSearchConfig.field) && data !== "Searching") {
                    _.map(data.pageOfResults, function (result) {
                        var programAttributesObj = {};
                        var key = "ID_Number";
                        var value = result.patientProgramAttributeValue;
                        // var arrayOfStringOfKeysValue = result.patientProgramAttributeValue && result.patientProgramAttributeValue.substring(2, result.patientProgramAttributeValue.length - 2).split('","');
                        // _.each(arrayOfStringOfKeysValue, function (keyValueString) {
                        //     var keyValueArray = keyValueString.split('":"');
                        //     var key = keyValueArray[0];
                        //     var value = keyValueArray[1];
                        if (!_.includes(_.keys(programAttributesObj), key)) {
                            programAttributesObj[key] = [];
                            programAttributesObj[key].push(value);
                        } else {
                            programAttributesObj[key].push(value);
                        }
                        // });
                        result.patientProgramAttributeValue = programAttributesObj;
                    });
                }
            };

            var showSearchResults = function (searchPromise) {
                $scope.noMoreResultsPresent = false;
                if (searchPromise) {
                    searchPromise.then(function (data) {
                        $scope.results = data.pageOfResults;
                        $scope.noResultsMessage = $scope.results.length === 0 ? 'REGISTRATION_NO_RESULTS_FOUND' : null;
                        if ($scope.results.length != 0)
                            $scope.results.sort(compare);
                        $scope.noMoreResultsPresent = true;
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
                    patientSearchResultConfigs.address = { "fields": allSearchConfigs.address ? [allSearchConfigs.address.field] : {} };
                    patientSearchResultConfigs.personAttributes
                        = {fields: allSearchConfigs.customAttributes ? allSearchConfigs.customAttributes.fields : {} };
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

            var identifyParams = function (querystring) {
                querystring = querystring.substring(querystring.indexOf('?') + 1).split('&');
                var params = {}, pair, d = decodeURIComponent;
                for (var i = querystring.length - 1; i >= 0; i--) {
                    pair = querystring[i].split('=');
                    params[d(pair[0])] = d(pair[1]);
                }
                return params;
            };

            initialize();

            $scope.disableSearchButton = function () {
                return !$scope.searchParameters.firstName && !$scope.searchParameters.fatherName && !$scope.searchParameters.grandFatherName && !$scope.searchParameters.addressFieldValue && !$scope.searchParameters.customAttribute && !$scope.searchParameters.programAttributeFieldValue;
            };

            $scope.$watch(function () {
                return $location.search();
            }, function () {
                showSearchResults(searchBasedOnQueryParameters(0));
            });

            var getQueue = function () {
                var params = {
                    q: "emrapi.sqlsearch.triagequeue",
                    v: "full"
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            $scope.triageQueue = function () {
                var searchbyid = getQueue().then(queue => queue.data.map(idno => {
                    patientService.search(undefined, idno.identifier, $scope.addressSearchConfig.field,
                        undefined, undefined, undefined, $scope.customAttributesSearchConfig.fields,
                        $scope.programAttributesSearchConfig.field, $scope.searchParameters.programAttributeFieldValue,
                        $scope.addressSearchResultsConfig.fields, $scope.personSearchResultsConfig.fields,
                        $scope.isExtraIdentifierConfigured())
                        .then(function (data) {
                            mapExtraIdentifiers(data);
                            mapCustomAttributesSearchResults(data);
                            mapAddressAttributesSearchResults(data);
                            mapProgramAttributesSearchResults(data);
                            if (idno.started == 1) {
                                angular.forEach(data.pageOfResults, function (result) {
                                    result.row_number = idno.row_number;
                                    result["background-color"] = idno.emergency_color;
                                    result.loc = idno.loc;
                                    $scope.results.push(result);
                                });
                            }
                            $scope.results.sort((a, b) => a.row_number - b.row_number);
                        })
                }))
            }

            var getCTQueue = function () {
                var params = {
                    q: "emrapi.sqlsearch.centralTriageQueue",
                    v: "full"
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };
            $scope.centralTriageQueue = function () {
                var searchbyid = getCTQueue().then(queue => queue.data.map(idno => {
                    patientService.search(undefined, idno.identifier, $scope.addressSearchConfig.field,
                        undefined, undefined, undefined, $scope.customAttributesSearchConfig.fields,
                        $scope.programAttributesSearchConfig.field, $scope.searchParameters.programAttributeFieldValue,
                        $scope.addressSearchResultsConfig.fields, $scope.personSearchResultsConfig.fields,
                        $scope.isExtraIdentifierConfigured())
                        .then(function (data) {
                            mapExtraIdentifiers(data);
                            mapCustomAttributesSearchResults(data);
                            mapAddressAttributesSearchResults(data);
                            mapProgramAttributesSearchResults(data);
                            if (idno.started == 1) {
                                angular.forEach(data.pageOfResults, function (result) {
                                    result.row_number = idno.row_number;
                                    result.loc = idno.loc;
                                    $scope.results.push(result);
                                });
                            }
                            $scope.results.sort((a, b) => a.row_number - b.row_number);
                        })
                }))
            };

            $scope.searchById = function () {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }
                if (!$scope.searchParameters.registrationNumber) {
                    return;
                }
                $scope.results = [];

                var patientIdentifier = $scope.searchParameters.registrationNumber;

                if (patientIdentifier.length < 4) {
                    messagingService.showMessage('error', 'Registration number must be at least 4 characters.');
                    return;
                }

                $location.search({
                    registrationNumber: $scope.searchParameters.registrationNumber,
                    programAttributeFieldName: $scope.programAttributesSearchConfig.field,
                    patientAttributes: $scope.customAttributesSearchConfig.fields,
                    programAttributeFieldValue: $scope.searchParameters.programAttributeFieldValue,
                    addressSearchResultsConfig: $scope.addressSearchResultsConfig.fields,
                    personSearchResultsConfig: $scope.personSearchResultsConfig.fields
                });

                var searchPromise = patientService.search(undefined, patientIdentifier, $scope.addressSearchConfig.field,
                    undefined, undefined, undefined, $scope.customAttributesSearchConfig.fields,
                    $scope.programAttributesSearchConfig.field, $scope.searchParameters.programAttributeFieldValue,
                    $scope.addressSearchResultsConfig.fields, $scope.personSearchResultsConfig.fields,
                    $scope.isExtraIdentifierConfigured())
                    .then(function (data) {
                        mapExtraIdentifiers(data);
                        mapCustomAttributesSearchResults(data);
                        mapAddressAttributesSearchResults(data);
                        mapProgramAttributesSearchResults(data);
                        if (data.pageOfResults.length === 1) {
                            var patient = data.pageOfResults[0];
                            var forwardUrl = appService.getAppDescriptor().getConfigValue("searchByIdForwardUrl") || "/patient/{{patientUuid}}";
                            $location.url(appService.getAppDescriptor().formatUrl(forwardUrl, { 'patientUuid': patient.uuid }));
                        } else if (data.pageOfResults.length > 1) {
                            $scope.results = data.pageOfResults;
                            $scope.noResultsMessage = null;
                        } else {
                            $scope.patientIdentifier = { 'patientIdentifier': patientIdentifier };
                            $scope.noResultsMessage = 'REGISTRATION_LABEL_COULD_NOT_FIND_PATIENT';
                        }
                    });
                spinner.forPromise(searchPromise);
            };
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

                var hasAnyValue = ($scope.searchParameters.firstName || "").trim() || ($scope.searchParameters.fatherName || "").trim() || ($scope.searchParameters.grandFatherName || "").trim();
                if (hasAnyValue) {
                    if ( ($scope.searchParameters.firstName || "").trim().length >= 3 && ($scope.searchParameters.fatherName || "").trim().length >= 3 && ($scope.searchParameters.grandFatherName || "").trim().length >= 3) {
                        console.log("Validation Passed: Ready to search.");
                    } else {
                        console.error("Validation Failed: Each name field must have at least 3 characters.");
                        messagingService.showMessage('error','Each name field must have at least 3 characters.');
                        return;
                    }
                }

                var queryParams = {};
                $scope.results = [];
                if ($scope.searchParameters.firstName || $scope.searchParameters.fatherName || $scope.searchParameters.grandFatherName) {
                    queryParams.name = ($scope.searchParameters.firstName || "") + '%' + ($scope.searchParameters.fatherName || "") + '%' + ($scope.searchParameters.grandFatherName || "");
                }
                // if ($scope.searchParameters.fatherName) {
                //     if($scope.searchParameters.firstName)
                //         if($scope.searchParameters.grandFatherName)
                //             queryParams.name = $scope.searchParameters.firstName + ' '+ $scope.searchParameters.fatherName + ' '+ $scope.searchParameters.grandFatherName;
                //         else queryParams.name = $scope.searchParameters.firstName + ' '+ $scope.searchParameters.fatherName;
                //     else queryParams.name = $scope.searchParameters.fatherName;
                // }
                // if ($scope.searchParameters.grandFatherName) {
                //     if($scope.searchParameters.firstName)
                //         if($scope.searchParameters.fatherName)
                //             queryParams.name = $scope.searchParameters.firstName + ' '+ $scope.searchParameters.fatherName + ' '+ $scope.searchParameters.grandFatherName;
                //         else queryParams.name = $scope.searchParameters.firstName + ' '+ $scope.searchParameters.fatherName;
                //     else queryParams.name = $scope.searchParameters.grandFatherName;
                // }
                if ($scope.searchParameters.addressFieldValue) {
                    queryParams.addressFieldValue = $scope.searchParameters.addressFieldValue;
                }
                if($scope.customAttributesSearchConfig.label === "Phone Number" && $scope.searchParameters.customAttribute.trim().length < 6 && $scope.searchParameters.customAttribute.trim().length > 0){
                    messagingService.showMessage('error','Phone number search require at least 6 Digits.');
                    return;
                }
                if ($scope.searchParameters.customAttribute && $scope.customAttributesSearchConfig.show) {
                    queryParams.customAttribute = $scope.searchParameters.customAttribute;
                }
                if ($scope.searchParameters.programAttributeFieldValue && $scope.programAttributesSearchConfig.show) {
                    queryParams.programAttributeFieldName = $scope.programAttributesSearchConfig.field;
                    queryParams.programAttributeFieldValue = $scope.searchParameters.programAttributeFieldValue;
                }
                $location.search(queryParams);
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
                        // angular.forEach(data.pageOfResults, function (result) {
                        //     $scope.results.push(result);
                        // });
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

            $scope.goToVisitPage = function () {
                if ($rootScope.crSearchTwo)
                    $rootScope.newCRPat = true;
                $location.path("/patient/" + $scope.selectedPatient.uuid + "/crTriageVisit/secondCtForm");
            };

            $scope.doExtensionAction = function (extension) {
                var forwardTo = appService.getAppDescriptor().formatUrl(extension.url, { 'patientUuid': $scope.selectedPatient.uuid });
                if (extension.label === 'Print') {
                    var params = identifyParams(forwardTo);
                    if (params.launch === 'dialog') {
                        var firstChar = forwardTo.charAt(0);
                        var prefix = firstChar === "/" ? "#" : "#/";
                        var hiddenFrame = $("#printPatientFrame")[0];
                        hiddenFrame.src = prefix + forwardTo;
                        hiddenFrame.contentWindow.print();
                    } else {
                        $location.url(forwardTo);
                    }
                } else {
                    $location.url(forwardTo);
                }
            };

            $scope.extensionActionText = function (extension) {
                return $filter('titleTranslate')(extension);
            };

            $scope.isExtraIdentifierConfigured = function () {
                return !_.isEmpty($scope.extraIdentifierTypes);
            };

            //All the codes below this line are added for Existing ER patients for search functionality and to open visit
            var loginLocationUuid = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid;
            var defaultVisitType = $rootScope.regEncounterConfiguration.getDefaultVisitType(loginLocationUuid);
            $scope.visitControl = new Bahmni.Common.VisitControl(
                $rootScope.regEncounterConfiguration.getVisitTypesAsArray(),
                defaultVisitType, encounterService, $translate, visitService
            );

            $scope.endExisitingVisit = async function () {

                try {
                    // Perform the search for active visits
                    const response = await visitService.search({
                        patient: $scope.selectedPatient.uuid,
                        includeInactive: false,
                        v: "custom:(uuid,location:(uuid),visitType:(name))"
                    });
                    const results = response.data.results;
                    // Check if there are results and end the visit if so
                    if (results && results.length > 0) {
                        await visitService.endVisit(results[0].uuid); // End the visit
                        // Log the visit closure
                        const messageParams = {
                            visitUuid: results[0].uuid,
                            visitType: results[0].visitType.name
                        };
                        await auditLogService.log($scope.selectedPatient.uuid, 'CLOSE_VISIT', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    }
                    // Call the selectTriage function
                    $scope.startVisitForExistedPatient()
                } catch (error) {
                    console.error("Error during visit process:", error);
                }
            }
            $scope.endExisitingVisitforCR = async function () {
                try {
                    // Perform the search for active visits
                    const response = await visitService.search({
                        patient: $scope.selectedPatient.uuid,
                        includeInactive: false,
                        v: "custom:(uuid,location:(uuid),visitType:(name))"
                    });
                    const results = response.data.results;
                    // Check if there are results and end the visit if so
                    if (results && results.length > 0) {
                        await visitService.endVisit(results[0].uuid); // End the visit
                        // Log the visit closure
                        const messageParams = {
                            visitUuid: results[0].uuid,
                            visitType: results[0].visitType.name
                        };
                        await auditLogService.log($scope.selectedPatient.uuid, 'CLOSE_VISIT', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    }
                    // Call the selectTriage function
                    $scope.startVisitForExistedPatientCR()
                } catch (error) {
                    console.error("Error during visit process:", error);
                }

            }
            
            $scope.endExisitingVisitforPedER = async function () {
                try {
                    // Perform the search for active visits
                    const response = await visitService.search({
                        patient: $scope.selectedPatient.uuid,
                        includeInactive: false,
                        v: "custom:(uuid,location:(uuid),visitType:(name))"
                    });
                    const results = response.data.results;
                    // Check if there are results and end the visit if so
                    if (results && results.length > 0) {
                        await visitService.endVisit(results[0].uuid); // End the visit
                        // Log the visit closure
                        const messageParams = {
                            visitUuid: results[0].uuid,
                            visitType: results[0].visitType.name
                        };
                        await auditLogService.log($scope.selectedPatient.uuid, 'CLOSE_VISIT', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    }
                    console.log('visitCLOSED');
                    // Call the selectTriage function
                    $scope.startVisitForExistedPatientPediER();
                } catch (error) {
                    console.error("Error during visit process:", error);
                }

            }
             $scope.visitCloseConfirmationPedER = function () {
                $scope.endExisitingVisitforPedER();
                ngDialog.close();
            };
            $scope.cancelConfirmationDialogPedER = function () {
                ngDialog.close();
            };
            $scope.visitCloseConfirmationCR = function () {
                $scope.endExisitingVisitforCR();
                ngDialog.close();
            };
            $scope.cancelConfirmationDialogCR = function () {
                ngDialog.close();
            };
            $scope.visitCloseConfirmation = function () {
                $scope.endExisitingVisit();
                ngDialog.close();
            };
            $scope.cancelConfirmationDialog = function () {
                ngDialog.close();
            };

            var getPediatricAgeLimit = async function () {
                var params = {
                    q: "get_pediatric_emergency_age",
                };

                return $http.get(Bahmni.Common.Constants.sqlUrl, {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            }
            //This method open visits for ER patients and redirect them to  ER triage form 
            $scope.startVisitForExistedPatient = async function (isPediatricsEmergecy = false) {
                const currentUrl = $location.absUrl();
                const response = await bedService.getAssignedBedForPatient($scope.selectedPatient.uuid);
                if (response) {
                    messagingService.showMessage("error", "The patient is currently occupying a bed. Patient needs to be discharged before closing the visit.");
                    return;
                }
                if($scope.selectedPatient.uuid){
                    let patientVisitHistory = await visitService.search({ patient: $scope.selectedPatient.uuid, v: 'custom:(attributes:(display),uuid,visitType,startDatetime,stopDatetime,location,encounters:(uuid,location,encounterType,encounterDatetime))', includeInactive: false })
                    // Assuming x is the variable holding your API response
                    $scope.numberOfACtiveVisits = patientVisitHistory.data.results.filter(result => result.stopDatetime === null).length;
                    if($scope.numberOfACtiveVisits > 0){
                        ngDialog.openConfirm({
                            template: 'views/closeActiveVisitsConfirmation.html',
                            scope: $scope,
                            closeByEscape: true,
                            className: "ngdialog-theme-default ng-dialog-adt-popUp"
                        });
                    }
                    else {
                        $scope.selectTriage();
                    }
                }
            };
            $scope.startVisitForExistedPatientPR = async function () {
                const response = await bedService.getAssignedBedForPatient($scope.selectedPatient.uuid);
                if (response) {
                    messagingService.showMessage("error", "The patient is currently occupying a bed. Patient needs to be discharged before closing the visit.");
                    return;
                }
                $scope.selectPediTriage();
            };
            var closeVisit = function (visitType) {
                if (visitType != undefined) {
                    visitService.endVisit(visitType.uuid).then(function () {
                        var messageParams = { visitUuid: visitType.uuid, visitType: visitType.visitType };
                        auditLogService.log($scope.selectedPatient.uuid, 'CLOSE_VISIT', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    });
                }
            };


            $scope.selectPediTriage = function () {
                $scope.dialog = ngDialog.open({
                    template: 'views/selectPediTriagePopUp.html',
                    className: 'test ngdialog-theme-default',
                    scope: $scope
                });
                $('body').addClass('show-controller-back');
                $scope.triageType = $scope.prTriageVisitTypes.VisitTypes;
            };

            $scope.selectedPRTriage = function (triageSelected) {
                $scope.triageSelected = triageSelected;
                var selectedVisitType = $scope.visitControl.visitTypes.filter(function (visitType) {
                    return visitType.name === $scope.triageSelected;
                })[0];
                $scope.visitControl.startVisit(selectedVisitType);
                if ($scope.selectedPatient.activeVisitUuid != null) {
                    visitService.getVisitSummary($scope.selectedPatient.activeVisitUuid).then(function (response) {
                        closeVisit(response.data)
                    })
                }
                return spinner.forPromise($scope.visitControl.createVisitOnly($scope.selectedPatient.uuid, $rootScope.visitLocation).then(function (response) {
                    auditLogService.log($scope.selectedPatient.uuid, "OPEN_VISIT", { visitUuid: response.data.uuid, visitType: response.data.visitType.display }, 'MODULE_LABEL_REGISTRATION_KEY');
                    $location.url("/patient/" + $scope.selectedPatient.uuid + "/crTriageVisit/" + $scope.triageSelected);
                    ngDialog.close();
                }))
            }

            $scope.selectTriage = function (){
                if($scope.selectedPatient.uuid!=undefined){
                    $scope.dialog = ngDialog.open({
                        template: 'views/selectTriagePopUp.html',
                        className: 'test ngdialog-theme-default',
                        scope: $scope});
                    $('body').addClass('show-controller-back');
                    if($scope.selectedPatient.gender != "M" && $scope.selectedPatient.age >= 18){
                        $scope.triageType = erTriageVisitTypes.OtherGreaterThan18;
                    }
                    else if($scope.selectedPatient.gender != "M" && $scope.selectedPatient.age < 18){
                        $scope.triageType = erTriageVisitTypes.OtherlessThan18;
                    }
                    else if($scope.selectedPatient.gender == "M" && $scope.selectedPatient.age >= 18){
                        $scope.triageType = erTriageVisitTypes.MaleGreaterThan18;
                    }
                    else{
                        $scope.triageType = erTriageVisitTypes.MaleLessThan18;
                    }
                }
            };


            $scope.locations;
            function getAllLoginLocations() {
                return locationService.getAllByTag("Login Location").then(function (response) {
                    $scope.locations = response.data.results;
                });
            }

            $scope.selectedTriage = function (triageSelected, isPediTriage = false) {
                $scope.triageSelected = triageSelected;
                var selectedVisitType = $scope.visitControl.visitTypes.filter(function (visitType) {
                    return visitType.name === $scope.triageSelected;
                })[0];
                $scope.visitControl.startVisit(selectedVisitType);
                $rootScope.regEncounterConfiguration;

                getAllLoginLocations().then(function() {
                    var filteredLocations = $scope.locations.filter(function(location) {
                        return location.display === "Pediatric Emergency Triage Location";
                    });

                    if (filteredLocations.length > 0) {
                        var selectedLocation = filteredLocations[0];
                        var visitDetails = {
                            patient: $scope.selectedPatient.uuid,
                            visitType: $rootScope.regEncounterConfiguration.visitTypes['Pediatric Emergency Triage'],
                            location: selectedLocation.uuid
                        };
                        visitService.createVisit(visitDetails).then(function (response) {})
                    }
                });
                // if ($scope.selectedPatient.activeVisitUuid != null) {
                //     visitService.endVisit($scope.selectedPatient.activeVisitUuid);
                //     visitService.getVisitSummary($scope.selectedPatient.activeVisitUuid).then(function (response) {
                //         closeVisit(response.data)
                //     })
                // }
                // return spinner.forPromise($scope.visitControl.createVisitOnly($scope.selectedPatient.uuid, $rootScope.visitLocation).then(function (response) {
                //     debugger;
                //         auditLogService.log($scope.selectedPatient.uuid, "OPEN_VISIT", {visitUuid: $scope.selectedPatient.activeVisitUuid, visitType: selectedVisitType}, 'MODULE_LABEL_REGISTRATION_KEY');   
                //         $location.url("/patient/" + $scope.selectedPatient.uuid + "/erTriageVisit/"+$scope.triageSelected);
                //     ngDialog.close();
                // })) 
                return spinner.forPromise(new Promise((resolve, reject) => {
                    // Simulate or replace with another API call or logic if necessary.
                    const response = { data: { uuid: 'visitUuidSample', visitType: { display: 'visitTypeDisplaySample' } } };
                    resolve(response);
                }).then((response) => {
                    auditLogService.log($scope.selectedPatient.uuid, "OPEN_VISIT", { visitUuid: $scope.selectedPatient.activeVisitUuid, visitType: selectedVisitType }, 'MODULE_LABEL_REGISTRATION_KEY');
                    if (isPediTriage)
                        $location.url("/patient/" + $scope.selectedPatient.uuid + "/erPediTriageVisit/" + $scope.triageSelected);
                    else
                        $location.url("/patient/" + $scope.selectedPatient.uuid + "/erTriageVisit/" + $scope.triageSelected);
                    ngDialog.close();
                }));
            }


            //This method open visits for CR patients and redirect them to  ER triage form 
            $scope.startVisitForExistedPatientCR = async function () {
                const response = await bedService.getAssignedBedForPatient($scope.selectedPatient.uuid);
                if (response) {
                    messagingService.showMessage("error", "The patient is currently occupying a bed. Patient needs to be discharged before closing the visit.");
                    return;
                }else if($rootScope.fromGynecology && $scope.selectedPatient.gender === 'M'){
                    messagingService.showMessage('error','Patient gender must be female');
                    return;
                }
                let patientVisitHistory = await visitService.search({ patient: $scope.selectedPatient.uuid, v: 'custom:(attributes:(display),uuid,visitType,startDatetime,stopDatetime,location,encounters:(uuid,location,encounterType,encounterDatetime))', includeInactive: false })
                $scope.numberOfACtiveVisits = patientVisitHistory.data.results.filter(result => result.stopDatetime === null).length;

                if ($scope.selectedPatient.uuid) {
                    $scope.numberOfACtiveVisits = patientVisitHistory.data.results.filter(result => result.stopDatetime === null).length;

                    // Assuming x is the variable holding your API response
                    if ($scope.numberOfACtiveVisits > 0) {

                        ngDialog.openConfirm({
                            template: 'views/closeActiveVisitsConfirmationCR.html',
                            scope: $scope,
                            closeByEscape: true,
                            className: "ngdialog-theme-default ng-dialog-adt-popUp"
                        });
                    } else {
                        $rootScope.newCRPat = true;

                        if (!$rootScope.fromPediatric) {
                            if($rootScope.fromToxicology){
                                var selectedVisitType = {
                                    name: "Toxicology Triage",
                                    uuid: $rootScope.regEncounterConfiguration.visitTypes['Toxicology Triage']
                                }
                            }
                            else if($rootScope.fromGynecology){
                                var selectedVisitType = {
                                    name: "Gynecology Triage",
                                    uuid: $rootScope.regEncounterConfiguration.visitTypes['Gynecology Triage']
                                }
                            }
                            else {
                                var selectedVisitType = {
                                    name: "Central Triage",
                                    uuid: $rootScope.regEncounterConfiguration.visitTypes['Central Triage']
                                }
                            }
                        }

                        if ($rootScope.fromPediatric) {
                            var selectedVisitType = {
                                name: "Pediatric Triage",
                                uuid: $rootScope.regEncounterConfiguration.visitTypes['Pediatric Triage']
                            }
                        }

                        $scope.visitControl.startVisit(selectedVisitType);
                        if ($scope.selectedPatient.activeVisitUuid != null) {
                            visitService.search({
                                patient: $scope.selectedPatient.uuid,
                                includeInactive: false,
                                v: "custom:(uuid,location:(uuid),visitType:(name))"
                            }).then(function (response) {
                                var results = response.data.results;
                                
                                spinner.forPromise($scope.visitControl.createVisitOnly($scope.selectedPatient.uuid, $rootScope.visitLocation).then(function (response) {
                                    auditLogService.log($scope.selectedPatient.uuid, "OPEN_VISIT", { visitUuid: response.data.uuid, visitType: response.data.visitType.display }, 'MODULE_LABEL_REGISTRATION_KEY');
                                }));
                                queueService.setPersistedCurrentServing($scope.queueCurrentServing);
                        $location.url("/patient/" + $scope.selectedPatient.uuid + "/crTriageVisit/" + $scope.triageSelected);
                            });
                        }
                    }
                }
            }
 $scope.startVisitForExistedPatientPediER = async function () {
    try {
        // Check if patient is in a bed
        const bedResponse = await bedService.getAssignedBedForPatient($scope.selectedPatient.uuid);
        if (bedResponse) {
            messagingService.showMessage("error", "The patient is currently occupying a bed. Patient needs to be discharged before closing the visit.");
            return;
        }

        // Check for active visitss
        const patientVisitHistory = await visitService.search({ 
            patient: $scope.selectedPatient.uuid, 
            v: 'custom:(attributes:(display),uuid,visitType,startDatetime,stopDatetime,location,encounters:(uuid,location,encounterType,encounterDatetime))', 
            includeInactive: false 
        }).catch(error => {
            console.error("Error fetching visit history:", error);
            messagingService.showMessage("error", "Failed to fetch patient visit history");
            return { data: { results: [] } };
        });
        
        const activeVisits = patientVisitHistory.data.results.filter(result => result.stopDatetime === null).length;

        if (activeVisits > 0) {
            // Show confirmation dialog to close existing visits
            ngDialog.openConfirm({
                template: 'views/closeActiveVisitsConfirmationPedER.html',
                scope: $scope,
                closeByEscape: true,
                className: "ngdialog-theme-default ng-dialog-adt-popUp"
            });
            return;
        }
        
        // Check pediatric age limit
        try {
            const pediAgeResponse = await getPediatricAgeLimit();
            $scope.pediAge = pediAgeResponse.data[0].property_value;

            if ($scope.selectedPatient.age > $scope.pediAge) {
                messagingService.showMessage("error", "Patient age is greater than " + $scope.pediAge + "!");
                return;
            }
        } catch (ageLimitError) {
            console.error("Error fetching pediatric age limit:", ageLimitError);
            messagingService.showMessage("error", "Failed to determine pediatric age limit");
            return;
        }

        // Start the visit
        const selectedVisitType = {
            name: "Pediatrics ER",
            uuid: $rootScope.regEncounterConfiguration.visitTypes['Pediatrics ER']
        };

        await $scope.visitControl.startVisit(selectedVisitType);
        
       if ($scope.selectedPatient.activeVisitUuid != null) {
            visitService.search({
                    patient: $scope.selectedPatient.uuid,
                    includeInactive: false,
                    v: "custom:(uuid,location:(uuid),visitType:(name))"
                        }).then(function (response) {
                            var results = response.data.results;

                            spinner.forPromise($scope.visitControl.createVisitOnly($scope.selectedPatient.uuid, $rootScope.visitLocation).then(function (response) {
                                auditLogService.log($scope.selectedPatient.uuid, "OPEN_VISIT", { visitUuid: response.data.uuid, visitType: response.data.visitType.display }, 'MODULE_LABEL_REGISTRATION_KEY');
                            }));
                            queueService.setPersistedCurrentServing($scope.queueCurrentServing);
                            $location.url("/patient/" + $scope.selectedPatient.uuid + "/erPediTriageVisit/" + $scope.triageSelected);
                        });
                    }
        
        // Set flag and redirect
        $rootScope.newERPat = true;
        $location.url("/patient/" + $scope.selectedPatient.uuid + "/erPediTriageVisit/Pediatrics ER");
        
    } catch (error) {
        console.error("Unexpected error in startVisitForExistedPatientPediER:", error);
        messagingService.showMessage("error", "An unexpected error occurred");
    }
}
 $scope.visitControl.onStartVisit = function () {
                //This method should be defined because the super visitControl.startVisit method calls it
            };

            //This method gives search functionality for ER patients
            $scope.searchErPatientsById = function () {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }
                if (!$scope.searchParameters.registrationNumber) {
                    return;
                }
                $scope.results = [];

                var patientIdentifier = $scope.searchParameters.registrationNumber;
                if (patientIdentifier.length < 4) {
                    messagingService.showMessage('error', 'Registration number must be at least 4 characters.');
                    return;
                } 

                $location.search({
                    registrationNumber: $scope.searchParameters.registrationNumber,
                    programAttributeFieldName: $scope.programAttributesSearchConfig.field,
                    patientAttributes: $scope.customAttributesSearchConfig.fields,
                    programAttributeFieldValue: $scope.searchParameters.programAttributeFieldValue,
                    addressSearchResultsConfig: $scope.addressSearchResultsConfig.fields,
                    personSearchResultsConfig: $scope.personSearchResultsConfig.fields
                });

                var searchPromise = patientService.search(undefined, patientIdentifier, $scope.addressSearchConfig.field,
                    undefined, undefined, undefined, $scope.customAttributesSearchConfig.fields,
                    $scope.programAttributesSearchConfig.field, $scope.searchParameters.programAttributeFieldValue,
                    $scope.addressSearchResultsConfig.fields, $scope.personSearchResultsConfig.fields,
                    $scope.isExtraIdentifierConfigured())
                    .then(function (data) {
                        mapExtraIdentifiers(data);
                        mapCustomAttributesSearchResults(data);
                        mapAddressAttributesSearchResults(data);
                        mapProgramAttributesSearchResults(data);
                        if (data.pageOfResults.length >= 1) {
                            $scope.results = data.pageOfResults;
                            $scope.noResultsMessage = null;
                        } else {
                            $scope.patientIdentifier = {'patientIdentifier': patientIdentifier};
                            $scope.noResultsMessage = 'REGISTRATION_LABEL_COULD_NOT_FIND_PATIENT';
                        }
                    });
                spinner.forPromise(searchPromise);
            };
        }]);
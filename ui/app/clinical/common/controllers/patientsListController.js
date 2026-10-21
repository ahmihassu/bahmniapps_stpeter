'use strict';
angular.module('bahmni.common.patientSearch')
.controller('PatientsListController', ['$scope', '$window', 'patientService', '$rootScope', 'appService', 'spinner',
    '$stateParams', '$bahmniCookieStore', 'printer', 'configurationService',  'observationsService', 'visitService','locationService','visitFormService','messagingService','queueService',
    function ($scope, $window, patientService, $rootScope, appService, spinner, $stateParams, $bahmniCookieStore, printer, configurationService,  observationsService, visitService,locationService,visitFormService,messagingService,queueService) {
        const DEFAULT_FETCH_DELAY = 2000;
        var patientSearchConfig = appService.getAppDescriptor().getConfigValue("patientSearch");
        var emergencyLocationNames = appService.getAppDescriptor().getExtensions("org.bahmni.clinical.emergencyLocation.names","erLoc");
        var patientListSpinner;
        $scope.triageStatus = "#88af28";

        // Queue widget state (used only for a specific search type in patientsList.html)
        $scope.queueCallPending = false;
        $scope.queueCardVisible = false;
        $scope.queueCurrentServing = '—';
        
        $scope.callNextTicket = function () {
            var locationName = $scope.currentLocation.name;
            if ($scope.queueCallPending) {
                return;
            }
            $scope.queueCallPending = true;
            queueService.callNext(locationName)
                .then(function (data) {
                    if (data && data.ticketNumber != null) {
                        $scope.queueCurrentServing = data.ticketNumber;
                        queueService.setPersistedCurrentServing(data.ticketNumber);
                    }
                })
                .catch(function (err) {
                    var msg = (err && err.data && err.data.message) ? err.data.message : (err && err.statusText) || "Request failed";
                })
                .finally(function () {
                    $scope.queueCallPending = false;
                });
        };

        var initialize = function () {
            var searchTypes = appService.getAppDescriptor().getExtensions("org.bahmni.patient.search", "config").map(mapExtensionToSearchType);
            $scope.currentLocation = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName);
            if (emergencyLocationNames && emergencyLocationNames.length > 0)
                var locations = emergencyLocationNames[0].Locations;
            locationService.getLoggedInLocation().then(function (loggedInLocation) {
                var parentLocation = loggedInLocation.parentLocation;
        
                if (emergencyLocationNames && emergencyLocationNames.length > 0 && locations.hasOwnProperty(parentLocation.display)) {
                    return locationService.getByUuid(parentLocation.uuid).then(function (parentLocation) {
                        $scope.currentLocation = parentLocation;
                        processSearchTypes(searchTypes, $scope.currentLocation, locations);
                    });
                } else {
                    processSearchTypes(searchTypes, $scope.currentLocation, locations);
                }
            }).catch(function (error) {
                console.error("Error fetching location:", error);
                processSearchTypes(searchTypes, $scope.currentLocation, locations);
            });
        };

        var hasBacteriologyPrivilege = function () {
            var bacteriologyResultPrivilege = Bahmni.Clinical.Constants.bacteriologyResultPrivilege;
            var hasPrivilege = _.filter($rootScope.currentUser.privileges, function (privilege) {
                return privilege.name === bacteriologyResultPrivilege;
            });
                return hasPrivilege.length > 0;
            };
        
        var hasCollectSamplePrivilege = function () {
            var collectSamplePrivilege = Bahmni.Clinical.Constants.collectSamplePrivilege;
            var hasPrivilege = _.filter($rootScope.currentUser.privileges, function (privilege) {
                return privilege.name === collectSamplePrivilege;
            });
                return hasPrivilege.length > 0;
            };

        var filterSpecialOrderSearchType = function(searchTypes){
            if(hasBacteriologyPrivilege() || hasCollectSamplePrivilege()){
                return searchTypes.filter(function(searchType){
                    return searchType.name === "Special Order" || searchType.name === "Sample Collection"
                })
            }
            else return searchTypes.filter(function(searchType){
                return searchType.name !== "Special Order" && searchType.name !== "Sample Collection"
            }) 
        }
        
        function processSearchTypes(searchTypes, currentLocation, locations) {
            if (emergencyLocationNames && emergencyLocationNames.length > 0){
                var isEmergencyLocation = emergencyLocationNames.length > 0 && locations.hasOwnProperty(currentLocation.name);
                
                var filteredSearchTypes = searchTypes.filter(function (searchType) {
                    if (isEmergencyLocation) {
                        const locations = emergencyLocationNames[0].Locations;
                        const keys = Object.keys(locations);
                        if(currentLocation.name === keys[1])
                            return searchType.InPediatricOnly !== false && searchType.InEmergencyOnly !== undefined;
                        if(currentLocation.name === keys[0])
                            return searchType.InPediatricOnly !== true && searchType.InEmergencyOnly !== undefined
                        else
                            return searchType.InEmergencyOnly !== undefined && searchType.InPediatricOnly !== true;
                    } else {
                        return searchType.InEmergencyOnly === undefined || searchType.InEmergencyOnly === false;
                    }
                });
            }

            filteredSearchTypes = filterSpecialOrderSearchType(filteredSearchTypes);
        
            $scope.search = new Bahmni.Common.PatientSearch.Search(_.without(filteredSearchTypes, undefined));
            $scope.search.markPatientEntry();    
            $scope.$watch('search.searchType', function (currentSearchType) {
                _.isEmpty(currentSearchType) || fetchPatients(currentSearchType);
            });            
            $scope.$watch('search.activePatients', function (activePatientsList) {
                if (activePatientsList.length > 0 && patientListSpinner) {
                    hideSpinner(spinner, patientListSpinner, $(".tab-content"));
                }
            });           
            if (patientSearchConfig && patientSearchConfig.serializeSearch) {
                getPatientCountSeriallyBySearchIndex(0);
            } else {
                _.each($scope.search.searchTypes, function (searchType) {
                    _.isEmpty(searchType) || ($scope.search.searchType !== searchType && getPatientCount(searchType, null));
                });
            }            
            if ($rootScope.currentSearchType != null) {
                $scope.search.switchSearchType($rootScope.currentSearchType);
            }           
            configurationService.getConfigurations(['identifierTypesConfig']).then(function (response) {
                $scope.primaryIdentifier = _.find(response.identifierTypesConfig, { primary: true }).name;
            });
        }
        
        $scope.start = function(patient){
            if(patient!=undefined){
                   
                patient.triageStatus = "#88af28";
              
                    if(patient.hasBeenAdmitted == "true"){
                          observationsService.fetch(patient.uuid, "Triage Color Result").then(function (response) {
                            if(response.data.length!=0){
                                patient.triageStatus = response.data[0].value;
                            }
                        })
                }
                consultationFilter(patient);
            }
        }
        $scope.style = function(patient){
            return { "background-color": patient.triageStatus };
        }
        $scope.styling = function(patient){
            return { "background-color" : "#191970"}
        }
        var consultationFilter = function(patient){
                visitService.getConsultationStatus(patient.activeVisitUuid).then((response) => {
                    if(response.data.length) 
                        patient["consulted"] = true;
                    else 
                        patient["consulted"] = false;
                })
            
        }
        $scope.searchPatients = function () {
            var isIdentifier = /\d/.test($scope.search.searchParameter);
            return (spinner.forPromise(isIdentifier ? patientService.bahmniSearchById($scope.search.searchParameter) : patientService.search($scope.search.searchParameter)).then(function (response) {
                $scope.search.updateSearchResults(response.data.pageOfResults);
                if ($scope.search.hasSingleActivePatient()) {
                    $scope.forwardPatient($scope.search.activePatients[0]);
                }
            }));
        };
        $scope.filterPatientsAndSubmit = function () {
            if ($scope.search.searchResults.length == 1) {
                $scope.forwardPatient($scope.search.searchResults[0]);
            }
        };
        var getPatientCount = function (searchType, patientListSpinner) {
            if (searchType.handler) {
                var params = { q: searchType.handler, v: "full",
                    location_uuid:  $scope.currentLocation.uuid,
                    provider_uuid: $rootScope.currentProvider.uuid };
                if (searchType.additionalParams) {
                    params["additionalParams"] = searchType.additionalParams;
                }
                patientService.findPatients(params).then(function (response) {
                    if ($scope.search.searchType.display == "Assigned Orders" && response.data.length > 0){
                            response.data = filterBasedOnAssignedUser(response.data)
                    }
                    searchType.patientCount = response.data.length;
                    if ($scope.search.isSelectedSearch(searchType)) {
                        $scope.search.updatePatientList(response.data);
                        if (response.data && response.data.length) {
                            response.data.forEach(function (patient) {
                            if($scope.search.searchType.name !== 'Special Order' && $scope.search.searchType.name !== 'Sample Collection')
                                patient.triageColor = 'notAssigned';
                                if ($scope.currentLocation.name && $scope.currentLocation.name  === "Pediatrics Emergency") {
                                    observationsService.fetch(patient.uuid, "Triage Color Result").then(function (res) {
                                        if (res.data && res.data.length > 0 && res.data[0].value) {
                                            patient.triageColor= res.data[0].value;
                                        }
                                    }).catch(function (err) {
                                        patient.triageColor = 'notAssigned';
                                    });
                                }
                            });
                        }
                    }
                    if (patientListSpinner) {
                        hideSpinner(spinner, patientListSpinner, $(".tab-content"));
                    }
                });
            }
        };
        var filterBasedOnAssignedUser = function(patientList){
            var newList = patientList.filter(function(patient){
                return patient.assignee == $rootScope.currentUser.username
                                        })
            return newList
        }
        var hideSpinner = function (spinnerObj, data, container) {
            spinnerObj.hide(data, container);
            $(container).children('patient-list-spinner').hide();
        };
        
        $scope.startVisit = function(patient) {
            if (patient.activeVisit === 1){
                messagingService.showMessage('error', 'Patient already has an active visit');
            }else{
                var visitDetails = {patient: patient.patientUuid, visitType: patient.visitTypeUuid, location: patient.stPeterLocationUuid};
                visitService.createVisit(visitDetails).then(function (response) {
                    messagingService.showMessage('info', 'Patient visit started');
                })
            }
        };
        $scope.getHeadings = function (patients) {
            if ($scope.search.searchType.name === 'Patients With PICT Appoointements') {
                if (!patients || patients.length === 0) {
                    return ["No patients"];
                }
                var headings = _.chain(patients[0]).keys().filter(function (heading) {
                    return heading === 'name' ||
                        heading === 'identifier' ||
                        heading === 'phone';
                }).value();

                headings.push('pictActions');
                return headings;
            }

            else if (patients && patients.length > 0) {
                var headings = _.chain(patients[0])
                    .keys()
                    .filter(function (heading) {
                        return _.indexOf(Bahmni.Common.PatientSearch.Constants.tabularViewIgnoreHeadingsList, heading) === -1;
                    })
                    .value();
                return headings;
            }
            return [];
        };
        $scope.isHeadingOfLinkColumn = function (heading) {
            var identifierHeading = _.includes(Bahmni.Common.PatientSearch.Constants.identifierHeading, heading);
            if (identifierHeading) {
                return identifierHeading;
            } else if ($scope.search.searchType && $scope.search.searchType.links) {
                return _.find($scope.search.searchType.links, {linkColumn: heading});
            }
            else if ($scope.search.searchType && $scope.search.searchType.linkColumn) {
                return _.includes([$scope.search.searchType.linkColumn], heading);
            }
        };
        $scope.isHeadingOfName = function (heading) {
            return _.includes(Bahmni.Common.PatientSearch.Constants.nameHeading, heading);
        };
        $scope.isHeadingOfLoc = function (heading) {
            return _.includes(Bahmni.Common.PatientSearch.Constants.locHeading, heading);
        };
        $scope.getPrintableHeadings = function (patients) {
            var headings = $scope.getHeadings(patients);
            var printableHeadings = headings.filter(function (heading) {
                return _.indexOf(Bahmni.Common.PatientSearch.Constants.printIgnoreHeadingsList, heading) === -1;
            });
            return printableHeadings;
        };
        $scope.printPage = function () {
            if ($scope.search.searchType.printHtmlLocation != null) {
                printer.printFromScope($scope.search.searchType.printHtmlLocation, $scope);
            }
        };
        var mapExtensionToSearchType = function (appExtn) {
            return {
                name: appExtn.label,
                display: appExtn.extensionParams.display,
                handler: appExtn.extensionParams.searchHandler,
                forwardUrl: appExtn.extensionParams.forwardUrl,
                forwardUrl2: appExtn.extensionParams.forwardUrl2,
                id: appExtn.id,
                params: appExtn.extensionParams.searchParams,
                refreshTime: appExtn.extensionParams.refreshTime || 0,
                view: appExtn.extensionParams.view || Bahmni.Common.PatientSearch.Constants.searchExtensionTileViewType,
                showPrint: appExtn.extensionParams.showPrint || false,
                printHtmlLocation: appExtn.extensionParams.printHtmlLocation || null,
                additionalParams: appExtn.extensionParams.additionalParams,
                searchColumns: appExtn.extensionParams.searchColumns,
                translationKey: appExtn.extensionParams.translationKey,
                linkColumn: appExtn.extensionParams.linkColumn,
                links: appExtn.extensionParams.links,
                InEmergencyOnly: appExtn.InEmergencyOnly,
                color: appExtn.color,
                InPediatricOnly: appExtn.InPediatricOnly
            };
        };
        var debounceGetPatientCount = _.debounce(function (currentSearchType, patientListSpinner) {
            getPatientCount(currentSearchType, patientListSpinner);
        }, (patientSearchConfig && patientSearchConfig.fetchDelay) || DEFAULT_FETCH_DELAY, {});
        var showSpinner = function (spinnerObj, container) {
            $(container).children('patient-list-spinner').show();
            return spinnerObj.show(container);
        };
        var fetchPatients = function (currentSearchType) {
            if (patientListSpinner !== undefined) {
                hideSpinner(spinner, patientListSpinner, $(".tab-content"));
            }
            $rootScope.currentSearchType = currentSearchType;
            if ($scope.search.isCurrentSearchLookUp()) {
                patientListSpinner = showSpinner(spinner, $(".tab-content"));
                if (patientSearchConfig && patientSearchConfig.debounceSearch) {
                    debounceGetPatientCount(currentSearchType, patientListSpinner);
                }
                else {
                    getPatientCount(currentSearchType, patientListSpinner);
                }
            }
        };
        $scope.selectedOption = '';
        $scope.setForwardUrl = function(option) {
            $scope.selectedOption = option;
        };
        $scope.forwardPatient = function (patient, heading) {
            var options = $.extend({}, $stateParams);
            $rootScope.ImagingRequest = patient["Imaging Request"]
            $rootScope.encounter = patient.encounter_id;
            $rootScope.patientAdmitLocationStatus = patient.Status;
            $.extend(options, {
                patientUuid: patient.uuid,
                visitUuid: patient.activeVisitUuid || null,
                encounterUuid: $stateParams.encounterUuid || 'active',
                programUuid: patient.programUuid || null,
                enrollment: patient.enrollment || null,
                forwardUrl: patient.forwardUrl || null,
                dateEnrolled: patient.dateEnrolled || null
            });
            var link = options.forwardUrl ? {
                url: options.forwardUrl,
                newTab: true
            } : {url: $scope.selectedOption === 'consultation' ? $scope.search.searchType.forwardUrl2 : $scope.search.searchType.forwardUrl, newTab: false};
            if ($scope.search.searchType.links) {
                link = _.find($scope.search.searchType.links, {linkColumn: heading}) || link;
            }
            if (link.url && link.url !== null) {
                if(patient.order_name) $window.open(appService.getAppDescriptor().formatUrl(link.url+"?order=" + patient.order_name, options, true), link.newTab ? "_blank" : "_self");
                else $window.open(appService.getAppDescriptor().formatUrl(link.url, options, true), link.newTab ? "_blank" : "_self");
            }
        };
        $scope.forwardLocPatient = function (patient, heading) {
            var options = $.extend({}, $stateParams);
            $rootScope.patientAdmitLocationStatus = patient.Status;
            $.extend(options, {
                patientUuid: patient.uuid,
                visitUuid: patient.activeVisitUuid || null,
                encounterUuid: $stateParams.encounterUuid || 'active',
                programUuid: patient.programUuid || null,
                enrollment: patient.enrollment || null,
                forwardUrl2: patient.forwardUrl || null,
                dateEnrolled: patient.dateEnrolled || null
            });
            var link = options.forwardUrl2 ? {
                url: options.forwardUrl2,
                newTab: true
            } : {url: $scope.search.searchType.forwardUrl2, newTab: false};
            if ($scope.search.searchType.links) {
                link = _.find($scope.search.searchType.links, {linkColumn: heading}) || link;
            }
            if (link.url && link.url !== null) {
                if(patient.test_name) $window.open(appService.getAppDescriptor().formatUrl(link.url+"?test=" + patient.test_name, options, true), link.newTab ? "_blank" : "_self");
                else $window.open(appService.getAppDescriptor().formatUrl(link.url, options, true), link.newTab ? "_blank" : "_self");
            }
        };
        var getPatientCountSeriallyBySearchIndex = function (index) {
            if (index === $scope.search.searchTypes.length) {
                return;
            }
            var searchType = $scope.search.searchTypes[index];
            if (searchType.handler) {
                var params = {
                    q: searchType.handler,
                    v: "full",
                    location_uuid: $scope.currentLocation.uuid,
                    provider_uuid: $rootScope.currentProvider.uuid
                };
                if (searchType.additionalParams) {
                    params["additionalParams"] = searchType.additionalParams;
                }
                patientService.findPatients(params).then(function (response) {
                    searchType.patientCount = response.data.length;
                    if ($scope.search.isSelectedSearch(searchType)) {
                        $scope.search.updatePatientList(response.data);
                    }
                    return getPatientCountSeriallyBySearchIndex(index + 1);
                });
            }
        };
        initialize();
    }
]);
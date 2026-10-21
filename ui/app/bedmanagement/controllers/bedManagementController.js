'use strict';

angular.module('bahmni.ipd')
    .controller('BedManagementController', ['$scope', '$rootScope', '$stateParams', '$state', 'spinner', 'wardService', 'bedManagementService', 'visitService', 'messagingService', 'appService', 'ngDialog',
        function ($scope, $rootScope, $stateParams, $state, spinner, wardService, bedManagementService, visitService, messagingService, appService, ngDialog) {
            $scope.wards = null;
            $scope.ward = {};
            $scope.editTagsPrivilege = Bahmni.IPD.Constants.editTagsPrivilege;
            $scope.children = null;
            var links = {
                "dashboard": {
                    "name": "inpatient",
                    "translationKey": "PATIENT_ADT_PAGE_KEY",
                    "url": "../bedmanagement/#/patient/{{patientUuid}}/visit/{{visitUuid}}/dashboard"
                }
            };

            var isDepartmentPresent = function (department) {
                if (!department) return false;
                return _.values(department).indexOf() === -1;
            };

            var selectDefaultWard = function () {
                $rootScope.$broadcast('askForSelected',"NA");
                $scope.$on('admitSelected', function (event, data) {
                    loadAllWards().then(function(){
                        $scope.onSelectDepartment(_.filter($scope.wards, {ward:{display:data}}, true)[0].ward);});
                    })         
            }
            selectDefaultWard();
            var init = function () {
                $rootScope.selectedBedInfo = $rootScope.selectedBedInfo || {};
                loadAllWards().then(function () {
                    var context = $stateParams.context || {};
                    if (context && isDepartmentPresent(context.department)) {
                        expandAdmissionMasterForDepartment(context.department);
                    } else if ($rootScope.bedDetails) {
                        expandAdmissionMasterForDepartment({
                            uuid: $rootScope.bedDetails.wardUuid,
                            name: $rootScope.bedDetails.wardName
                        });
                    }
                    resetDepartments();
                    resetBedInfo();
                });
            };

            var loadAllWards = function () {
                return spinner.forPromise(wardService.getWardsList().success(function (wardsList) {
                    $scope.wards = wardsList.results;
                }));
            };

            var mapRoomInfo = function (roomsInfo) {
                var mappedRooms = [];
                _.forIn(roomsInfo, function (value, key) {
                    var bedsGroupedByBedStatus = _.groupBy(value, 'status');
                    var availableBeds = bedsGroupedByBedStatus["AVAILABLE"] ? bedsGroupedByBedStatus["AVAILABLE"].length : 0;
                    mappedRooms.push({name: key, beds: value, totalBeds: value.length, availableBeds: availableBeds});
                });
                return mappedRooms;
            };

            var getRoomsForWard = function (bedLayouts) {
                var rooms = mapRoomInfo(_.groupBy(bedLayouts, 'location'));
                _.each(rooms, function (room) {
                    room.beds = bedManagementService.createLayoutGrid(room.beds);
                });
                return rooms;
            };

            var getWardDetails = function (department) {
                return _.filter($scope.wards, function (entry) {
                    return entry.ward.uuid === department.uuid;
                });
            };

            var selectCurrentDepartment = function (department) {
                _.each($scope.wards, function (wardElement) {
                    if (wardElement.ward.uuid === department.uuid) {
                        wardElement.ward.isSelected = true;
                        wardElement.ward.selected = true;
                    }
                });
            };

            var loadBedsInfoForWard = function (department) {
                return wardService.bedsForWard(department.uuid).then(function (response) {
                    console.log(response);
                    
                    var wardDetails = getWardDetails(department);
                    var rooms = getRoomsForWard(response.data.bedLayouts);
                    $scope.ward = {
                        rooms: rooms,
                        uuid: department.uuid,
                        name: department.name,
                        totalBeds: wardDetails[0] ? wardDetails[0].totalBeds : 0,
                        occupiedBeds: wardDetails[0] ? wardDetails[0].occupiedBeds : 0
                    };
                    if(department.childLocations && department.childLocations.length>0 && $scope.ward.totalBeds==0){
                        _.each(department.childLocations, function (option) {
                            wardService.bedsForWard(option.uuid).then(function (resp) {
                                var rooms2 = getRoomsForWard(resp.data.bedLayouts);
                                var sum = rooms2.reduce((partialSum, a) => partialSum + a.totalBeds, 0)
                                $scope.ward.totalBeds = $scope.ward.totalBeds + sum
                                
                            })
                            
                        });
                        
                    }
                    $scope.departmentSelected = true;
                    $rootScope.selectedBedInfo.wardName = department.name;
                    $rootScope.selectedBedInfo.wardUuid = department.uuid;
                    selectCurrentDepartment(department);
                    $scope.$broadcast("event:departmentChanged");
                });
            };

            var expandAdmissionMasterForDepartment = function (department) {
                spinner.forPromise(loadBedsInfoForWard(department));
            };

            $scope.onSelectDepartment = function (department, isdep) {
                spinner.forPromise(loadBedsInfoForWard(department).then(function () {
                    if(department.childLocations && department.childLocations.length>0 && $scope.ward.totalBeds==0 && isdep){
                        $scope.children = department.childLocations;
                        _.each($scope.children, function (option) {
                            option.parentuuid = department.uuid;
                        });
                    }
                    else if(!department.childLocations){
                        ;
                    }
                    else{$scope.children = null; $scope.skipFlag = null;}
                    resetPatientAndBedInfo();
                    resetDepartments();
                    $scope.$broadcast("event:deselectWards");
                    department.isSelected = true;
                }));
            };
            $scope.skipFlag = null;
            var resetDepartments = function () {
                _.each($scope.wards, function (option) {
                    if($scope.skipFlag==option.ward.uuid){
                        option.ward.isSelected = true;
                        $scope.skipFlag = null;
                    }
                    else{
                        option.ward.isSelected = false;
                    }
                    _.each($scope.children, function (chil) {
                        if(chil.parentuuid == option.ward.uuid){
                            $scope.skipFlag = chil.parentuuid;
                        }  
                    });    
                    
                });
                _.each($scope.children, function (option) {
                    option.isSelected = false;
                });
            };

            var resetBedInfo = function () {
                $rootScope.selectedBedInfo.roomName = undefined;
                $rootScope.selectedBedInfo.bed = undefined;
            };

            var resetPatientAndBedInfo = function () {
                resetBedInfo();
                goToBedManagement();
            };

            $scope.$on("event:patientAssignedToBed", function (event, bed) {
                $scope.ward.occupiedBeds = $scope.ward.occupiedBeds + 1;
                _.map($scope.ward.rooms, function (room) {
                    if (room.name === $scope.roomName) {
                        room.availableBeds = room.availableBeds - 1;
                    }
                });
            });

            $scope.$on("event:updateSelectedBedInfoForCurrentPatientVisit", function (event, patientUuid) {
                getVisitInfoByPatientUuid(patientUuid).then(function (visitUuid) {
                    var options = { patientUuid: patientUuid, visitUuid: visitUuid };
                    $state.go("bedManagement.patient", options);
                });
            });

            var goToBedManagement = function () {
                if ($state.current.name === "bedManagement.bed") {
                    var options = {};
                    options['context'] = {
                        department: {
                            uuid: $scope.ward.uuid,
                            name: $scope.ward.name
                        },
                        roomName: $scope.roomName
                    };
                    options['dashboardCachebuster'] = Math.random();
                    $state.go("bedManagement", options);
                }
            };

            var getVisitInfoByPatientUuid = function (patientUuid) {
                return visitService.search({
                    patient: patientUuid, includeInactive: false, v: "custom:(uuid,location:(uuid))"
                }).then(function (response) {
                    var results = response.data.results;
                    var activeVisitForCurrentLoginLocation;
                    if (results) {
                        activeVisitForCurrentLoginLocation = _.filter(results, function (result) {
                            return result.location.uuid === $rootScope.visitLocationUuid;
                        });
                    }
                    var hasActiveVisit = activeVisitForCurrentLoginLocation.length > 0;
                    return hasActiveVisit ? activeVisitForCurrentLoginLocation[0].uuid : "";
                });
            };

            $scope.goToAdtPatientDashboard = function () {
                getVisitInfoByPatientUuid($scope.patient.uuid).then(function (visitUuid) {
                    var options = {patientUuid: $scope.patient.uuid, visitUuid: visitUuid};
                    var url = appService.getAppDescriptor().formatUrl(links.dashboard.url, options);
                    window.open(url);
                });
                if (window.scrollY > 0) {
                    window.scrollTo(0, 0);
                }
            };

            $scope.canEditTags = function () {
                return $rootScope.selectedBedInfo.bed && $state.current.name === "bedManagement.bed";
            };

            $scope.editTagsOnTheBed = function () {
                ngDialog.openConfirm({
                    template: 'views/editTags.html',
                    scope: $scope,
                    closeByEscape: true,
                    className: "ngdialog-theme-default ng-dialog-adt-popUp"
                });
            };

            init();
        }]);
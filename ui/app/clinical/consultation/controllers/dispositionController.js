'use strict';

angular.module('bahmni.clinical')
    .controller('DispositionController', ['messagingService', '$stateParams', 'visitFormService', '$rootScope', '$scope', '$http', '$q', '$location', '$timeout', 'dispositionService', 'retrospectiveEntryService', 'spinner', 'visitService', 'locationService', 'appService', '$bahmniCookieStore', 'electiveSurgeryService', 'userService', function (messagingService, $stateParams, visitFormService, $rootScope, $scope, $http, $q, $location, $timeout, dispositionService, retrospectiveEntryService, spinner, visitService, locationService, appService, $bahmniCookieStore, electiveSurgeryService, userService) {
        var consultation = $scope.consultation;
        var allDispositions = [];
        var wards= $http.get("/openmrs/ws/rest/v1/admissionLocation/");
        var encounterConfig = $rootScope.encounterConfig;
        var getVisitTypes = function () {
        return $q.when(encounterConfig.getVisitTypes());
        }; 
        $scope.activeVisitType = $scope.$parent.activeVisit.visitType.name;
        var emergencyLocationNames = appService.getAppDescriptor().getExtensions("org.bahmni.clinical.emergencyLocation.names","erLoc");
        $scope.procedures = []
        $scope.isVIP = false;
        $scope.replicaAppointmentNote = { value: '' };
        $scope.appointmentNote = { value: '' };

        getVisitTypes().then(function (data) {
            $scope.visitType = data;
        });

        $scope.selectProcedure = function (selectedProcedure) {
            $scope.selectedProcedure = $scope.procedures.filter((prc) => {
                return prc.procedureName === selectedProcedure
            })

        };

        $scope.selectCatagory = function (selectedCatagory) {
            $scope.selectedCatagory = $scope.catagories.filter((prc) => {
                return prc.name === selectedCatagory
            })
        };

        $scope.selectVIP = function (isVIP) {
            $scope.isVIP = isVIP;
        }

        var currentLocation = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName);
        var locations = emergencyLocationNames[0].Locations;

        electiveSurgeryService.getProcedures().then((response) => {
            $scope.procedures = response.data.data || [];
            if ($scope.procedures && $scope.procedures.length) {
                $scope.procedures.forEach((procedure, index) => {
                    if (procedure.procedureId === undefined) {
                        console.log(`Missing procedureId at index ${index}`, procedure);
                    }
                });
            } else {
                console.log("procedures array is undefined or empty");
            }

        })

        electiveSurgeryService.getCatagories().then((response) => {
            $scope.catagories = response.data.data || [];
            if ($scope.catagories && $scope.catagories.length) {
                $scope.catagories.forEach((catagories, index) => {
                    if (catagories.categoryId === undefined) {
                        console.log(`Missing catagories at index ${index}`, catagories);
                    }
                });
            } else {
                console.log("catagories array is undefined or empty");
            }
        })


        locationService.getLoggedInLocation().then(function (loggedInLocation) {
            var parentLocation = loggedInLocation.parentLocation;
            currentLocation = loggedInLocation;
            
            if (locations.hasOwnProperty(parentLocation.display)) {
                locationService.getByUuid(parentLocation.uuid).then(function (parentLocation) {
                    currentLocation = parentLocation;
                    $scope.isEmergencyLocation = emergencyLocationNames.length > 0 && locations.hasOwnProperty(currentLocation.name);
                    
                    if ($scope.isEmergencyLocation) {
                        $scope.visitType = currentLocation.childLocations.filter((cld) => {
                            return cld.display !== $scope.$parent.activeVisit.visitType.display;
                        });
                    }
                });
            } else {
                $scope.isEmergencyLocation = emergencyLocationNames.length > 0 && locations.hasOwnProperty(currentLocation.name);
                
                if ($scope.isEmergencyLocation) {
                  
                    $scope.visitType = currentLocation.childLocations.filter((cld) => { 
                        return cld.display !== $scope.$parent.activeVisit.visitType.display;
                    });
                }
             
            }
            
            spinner.forPromise(loadDispositionActions(), '#disposition');
        }).catch(function (error) {
            console.error("Error fetching location:", error);
        });
        $scope.wards = [];
        $scope.bedServices = [];
        var loadAllWards = function () {
            return wards.success(function (wardsList) {
                    $scope.wards = wardsList.results;
            });
        };
        var getBedServices = function () {
            var params = {
                q: "bahmni.sqlGet.getBedServices"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        loadAllWards();
        $scope.patientIsDecalredDead = false;
        $scope.patientHasDiagnosis = false;

        $scope.patientHasReferralForm = false;

        // Check if the referral form is filled
        visitFormService.formData($scope.patient.uuid, 1, ["Referral Form"]).then(function (res) {
            console.log("Referral Form Data:", res.data.results); // Debugging
            $scope.patientHasReferralForm = res.data.results.length > 0;
        }).catch(function (error) {
            console.error("Error fetching referral form data:", error);
        });
        visitFormService.formData($scope.patient.uuid, 1, ["Death Notification"]).then(function (res){
            $scope.patientIsDecalredDead = res.data.results.length > 0;
        })
        // get list of diagnosis and check if there is a main diagnosis
        visitFormService.formData($scope.patient.uuid, 10, ["Coded Diagnosis"], undefined, "full").then(function (res){
            res.data.results.forEach(diagnosis => {
                if (diagnosis.obsGroup.comment === "~Main") {
                    $scope.patientHasDiagnosis = true;
                }
            });
        })
        getBedServices().then(function(r){
            $scope.bedServices = r.data;
        });

        
        //For redirection from ER triage visit
        var triageScoreResult =$location.search()['TriageScoreResult'];
        var triageColorResult =$location.search()['TriageColorResult'];
        var firstGo = 0;        
        var setNotes = function(){
            if(!angular.isUndefined(triageScoreResult)){
                var unregister = $scope.$watch('dispositionCode', function () {
                    $scope.dispositionCode = "KEEP_PATIENT";
                    firstGo++;
                    if(firstGo==4){unregister();}
                    
                });
                var unregister2 = $scope.$watch('dispositionNote', function () {
                    if($scope.dispositionNote!=undefined){
                    $scope.dispositionNote.value = 'Triage Score Result is ' + triageScoreResult + ' And Triage Color Result is ' + triageColorResult;
                    unregister2();}
                });
            }
        }

        setNotes();

        var getPhoneNumber = function (personuuid) {
            var params = {
                q: "get_patient_phone_with_person_uuid",
                person_uuid: personuuid
            };
            return $http.get(Bahmni.Common.Constants.sqlUrl, {
                method: "GET",
                params: params,
                withCredentials: true
            });
        }

        var getPreviousDispositionNote = function () {
            if (consultation.disposition && (!consultation.disposition.voided)) {
                return _.find(consultation.disposition.additionalObs, function (obs) {
                    return obs.concept.uuid === $scope.dispositionNoteConceptUuid;
                });
            }
        };

        var getDispositionNotes = function () {
            var previousDispositionNotes = getPreviousDispositionNote();
            if (getSelectedConceptName($scope.dispositionCode, $scope.dispositionActions)) {
                return _.cloneDeep(previousDispositionNotes) || {concept: {uuid: $scope.dispositionNoteConceptUuid}};
            }
            else {
                return {concept: {uuid: $scope.dispositionNoteConceptUuid}};
            }
        };

        var getDispositionActionsPromise = function () {
            return dispositionService.getDispositionActions().then(function (response) {
                allDispositions = new Bahmni.Clinical.DispostionActionMapper().map(response.data.results[0].answers);
                $scope.dispositionActions = filterDispositionActions(allDispositions, $scope.$parent.visitSummary);
                $scope.dispositionCode = consultation.disposition && (!consultation.disposition.voided) ? consultation.disposition.code : null;
                $scope.dispositionNote = getDispositionNotes();
            });
        };

        var getDispositionActions = function (finalDispositionActions, dispositions, action) {
            var copyOfFinalDispositionActions = _.cloneDeep(finalDispositionActions);
            var dispositionPresent = _.find(dispositions, action);
            if (dispositionPresent) {
                copyOfFinalDispositionActions.push(dispositionPresent);
            }
            if (!$scope.isEmergencyLocation) {
                copyOfFinalDispositionActions = copyOfFinalDispositionActions.filter(cpy => {
                    return cpy.code !== "MOVE_ER" &&
                           (cpy.code !== "UnKeep") &&
                           (cpy.code !== "KEEP");
                });
            } 
            return copyOfFinalDispositionActions;
        };

        var filterDispositionActions = function (dispositions, visitSummary) {  
            

            if (!consultation.dispositions) {
                consultation.dispositions = [];
            }
            // Fetch previous dispositions if not already available
            if (consultation.dispositions.length === 0 && consultation.disposition) {
                consultation.dispositions.push(consultation.disposition);
            }
            var isPatientKept = consultation.dispositions.some(function (d) {
                return d.code === "KEEP";
            });
            var defaultDispositions = ["Undo Discharge", "Admit Patient", "Transfer Patient", "Discharge Patient"];
            var finalDispositionActions = _.filter(dispositions, function (disposition) {
                return defaultDispositions.indexOf(disposition.name) < 0 && disposition.name !== 'Send Home';
            });
            finalDispositionActions = finalDispositionActions.filter(function (action) {
                if (action.code === "KEEP") {
                    return !isPatientKept;
                } else if (action.code === "UnKeep") {
                    return isPatientKept;
                }
                return true; // Keep other dispositions

            });

            var currentVisitType = $scope.$parent.activeVisit.visitType.display;
            var isVisitOpen = visitSummary ? _.isEmpty(visitSummary.stopDateTime) : false;

            if (currentVisitType !== 'IPD') { // Assuming 'IPD' is the display name for Inpatient Department
                var sendHomeDisposition = _.find(dispositions, { name: 'Send Home' });
                if (sendHomeDisposition) {
                    finalDispositionActions.push(sendHomeDisposition);
                }
            }
            
            if (visitSummary && visitSummary.isDischarged() && isVisitOpen) {
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[0]});
            }
            else if (visitSummary && visitSummary.isAdmitted() && isVisitOpen) {
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[2]});
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[3]});
            }
            else {
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[1]});
            }
            return finalDispositionActions;
        };

        $scope.isRetrospectiveMode = function () {
            return !_.isEmpty(retrospectiveEntryService.getRetrospectiveEntry());
        };

        $scope.showWarningForEarlierDispositionNote = function () {
            return !$scope.dispositionCode && consultation.disposition;
        };

        var getDispositionNotePromise = function () {
            return dispositionService.getDispositionNoteConcept().then(function (response) {
                $scope.dispositionNoteConceptUuid = response.data.results[0].uuid;
            });
        };

        var loadDispositionActions = function () {
            return getDispositionNotePromise().then(getDispositionActionsPromise);
        };

        $scope.clearDispositionNote = function () {
            $scope.dispositionNote.value = null;
            //check if the disposition is something specific and  if the patient does not have main diagnosis, redirect
            $rootScope.deadToSave = false;
            let smallDisposition = $scope.dispositionCode ? $scope.dispositionCode.toLowerCase() : "";
            let dispositionIsDead = smallDisposition.includes("dead");
            let dispositionIsRefer = smallDisposition.includes("refer");
            let dispositionIsAdmit = smallDisposition.includes("admit");
            let listOfDispositions = ["dead", "refer", "discharge", "send","admit"]
            let dispositionIsx = false;
            listOfDispositions.forEach(element => {
                if (smallDisposition.includes(element)){
                    dispositionIsx = true;
                }
            });
            if (dispositionIsx) {
                if ($scope.patientHasDiagnosis) {
                    //fill with things that need to be done if main diagnosis is filled
                    if (dispositionIsDead) {
                        if ($scope.patientIsDecalredDead) {
                            //put something in rootscope to modify the save
                            $rootScope.deadToSave = true;
                        }
                        else {
                            $scope.dispositionCode = undefined;
                            $rootScope.reqDeathNotification = true;
                            messagingService.showMessage("error", "The Death Notification Form needs to be filled first. Please fill it out now and save it before proceeding to fill the disposition");
                            $location.path($location.path().replace("disposition", "concept-set-group/observations"));
                        }
                    }
                }
                else {
                    $scope.dispositionCode = undefined;
                    messagingService.showMessage("error", "The Main Diagnosis has to be filled out before taking this action. Please fill it out now and save it before proceeding to fill the disposition");
                    $location.path($location.path().replace("disposition", "diagnosis"));
                }

                if (dispositionIsRefer) {
                    if ($scope.patientHasReferralForm) {
                        // Allow the referral action
                    } else {
                        $scope.dispositionCode = undefined;
                        messagingService.showMessage("error", "The Referral Form needs to be filled first. Please fill it out now and save it before proceeding to refer the patient.");
                        $location.path(`/default/patient/${$scope.patient.uuid}/dashboard/concept-set-group/observations`);
                    }
                }
                if (dispositionIsAdmit){
                    if(!$scope.patientHasDiagnosis){
                        $scope.dispositionCode = undefined;
                        messagingService.showMessage("error", "The Main Diagnosis has to be filled out before taking this action. Please fill it out now and save it before proceeding to fill the disposition");
                        $location.path($location.path().replace("disposition", "diagnosis"));
                    }
                }
            }
        };

        var getSelectedConceptName = function (dispositionCode, dispositions) {
            var selectedDispositionConceptName = _.findLast(dispositions, {code: dispositionCode}) || {};
            return selectedDispositionConceptName.name;
        };

        var getSelectedDisposition = function () {
            if ($scope.dispositionCode) {
                $scope.dispositionNote.voided = !$scope.dispositionNote.value;
                var disposition = {
                    additionalObs: [],
                    dispositionDateTime: consultation.disposition && consultation.disposition.dispositionDateTime,
                    code: $scope.dispositionCode,
                    conceptName: getSelectedConceptName($scope.dispositionCode, allDispositions)
                };
                if ($scope.dispositionNote.value || $scope.dispositionNote.uuid) {
                    disposition.additionalObs = [_.clone($scope.dispositionNote)];
                }
                return disposition;
            }
        };

        //spinner.forPromise(loadDispositionActions(), '#disposition');

        var getAvailableBedServiceOrder = function () {
            return _.filter($scope.consultation.orders, function (order) {
                return order.orderType == "Bed Service";
            }); 
        };
        var discontinueBedServices = function (bedServices) {
            for(let i = 0; i < bedServices.length; i++) {
                bedServices[i].isDiscontinued = true;
            }
        }

        var saveDispositions = function () {

            if($scope.dispositionCode === "Send Home" ){
                visitService.endVisit($scope.activeVisit.uuid).then(function (response) {
                    if (response.status === 200) {
                        messagingService.showMessage('info', 'Patient visit closed Successfully');
                    }
               });
            }  

            if($scope.selectedWard!= undefined && $scope.dispositionCode=='ADMIT'){
                var prevAdmitCheck;
                var selectedBedService;
                var bedServiceOrder;
                if($scope.dispositionNote.value){
                    prevAdmitCheck = $scope.dispositionNote.value.split(": ");
                    if(prevAdmitCheck.length == 2){
                        $scope.dispositionNote.value=prevAdmitCheck[0]+ ": " + $scope.selectedWard;
                    }
                    else{
                        $scope.dispositionNote.value= $scope.dispositionNote.value+"\nPatient Sent to: "+ $scope.selectedWard;
                    }
                }
                else{
                    $scope.dispositionNote.value="Patient Sent to: "+ $scope.selectedWard;
                }
                selectedBedService = _.find($scope.bedServices, function (bedService) {

                    return $scope.selectedWard.toLowerCase() == bedService.name.toLowerCase();

                });
                if(selectedBedService) {
                    bedServiceOrder = {concept: selectedBedService, commentToFulfiller: "", urgency: "ROUTINE"};
                    var availableBedServiceOrders = getAvailableBedServiceOrder();
                    var alreadyExistsBedService =  _.find(availableBedServiceOrders, function(bedService) {
                        return bedService.concept.name.toLowerCase() ==  $scope.selectedWard.toLowerCase();
                    })
                    if(!alreadyExistsBedService) {
                        if(availableBedServiceOrders && availableBedServiceOrders.length > 0) {
                            discontinueBedServices(availableBedServiceOrders);
                        } 
                            $scope.consultation.orders.push(bedServiceOrder);
                    }
                }
                
            }
                
            if($scope.selectedTransferWard !== undefined && $scope.dispositionCode === 'TRANSFER'){
                
                var prevAdmitCheck;
                if($scope.dispositionNote.value){
                    prevAdmitCheck = $scope.dispositionNote.value.split(": ");
                    if(prevAdmitCheck.length == 2){
                        $scope.dispositionNote.value=prevAdmitCheck[0]+ ": " + $scope.selectedTransferWard;
                    }
                    else {
                        $scope.dispositionNote.value = $scope.dispositionNote.value + "\nPatient Transferred to: " + $scope.selectedTransferWard;
                      }
                }
                else {
                    $scope.dispositionNote.value = "Patient Transferred to: " + $scope.selectedTransferWard;
                }
            }

            if ($scope.dispositionCode === 'Elective Surgery Appointment (Elective Surgery Appointment)') {
                $scope.dispositionCode = '';
                var mainDiagnosisFromSaved = null;

                if(consultation.savedDiagnosesFromCurrentEncounter.length === 0){
                    mainDiagnosisFromSaved = (consultation.mainDiagnoses!= undefined) ? mainDiagnosisFromSaved = consultation.mainDiagnoses.filter(res => {
                            if(res.comments == "~Main") { return res; }
                    }) : consultation.pastDiagnoses.filter(res => {
                            if(res.comments == "~Main") { return res; }
                    });

                    
                } else {
                    mainDiagnosisFromSaved = consultation.savedDiagnosesFromCurrentEncounter.filter(res => {
                            if(res.comments == "~Main") { return res; }
                        });
                }

                $scope.diagnosis = mainDiagnosisFromSaved.length > 0
                    ? mainDiagnosisFromSaved
                    : consultation.pastDiagnoses.filter(res => res.comments === "~Main"); 
 
                if (!$scope.diagnosis || $scope.diagnosis.length === 0) {
                    messagingService.showMessage("error", "The patient has no main diagnosis.");
                    console.error("Diagnosis is not available.");
                    return;
                }

                $scope.diagnosis.name = parseDiagnosis($scope.diagnosis[0].codedAnswer.name);
                // Admission logic for elective surgery
                if ($scope.selectedWard !== undefined) {
                    const prevAdmitCheck = $scope.dispositionNote.value?.split(": ");
                    if (prevAdmitCheck?.length === 2) {
                        $scope.dispositionNote.value = `${prevAdmitCheck[0]}: ${$scope.selectedWard}`;
                    } else {
                        $scope.dispositionNote.value = $scope.dispositionNote.value
                            ? `${$scope.dispositionNote.value}\nPatient Sent to: ${$scope.selectedWard}${$scope.selectedUrgency ? ` with urgency status: ${$scope.selectedUrgency}` : ""
                            }`
                            : `Patient Sent to: ${$scope.selectedWard}${$scope.selectedUrgency ? ` with urgency status: ${$scope.selectedUrgency}` : ""
                            }`;
                    }
                }

                $scope.patient.gender = $scope.patient.gender === "M" ? "MALE" : "FEMALE";
                $scope.physicianName = '';
                $scope.physicianUuid = '';
                $scope.physicianDepartment = ''

                locationService.getLoggedInLocation().then(function (loggedInLocation) {
                    $scope.physicianDepartment = loggedInLocation.name;
                    
                }).catch(function (error) {
                    console.error("Error fetching location:", error);
                    processSearchTypes(searchTypes, $scope.currentLocation, locations);
                });

                return Promise.all([
                    getPhoneNumber($scope.patient.uuid),
                    getSurgeryAppointmentAttributeTypeUuids()
                ]).then(async ([phoneResponse, attributeTypeResponse]) => {
                        // if (!phoneResponse.data[0]) {
                        //     messagingService.showMessage("error", "Phone number is required for the patient.");
                        //     throw new Error("Missing phone number");
                        // }

                        if (!attributeTypeResponse.data || !attributeTypeResponse.data[0]) {
                            messagingService.showMessage("error", "Could not find Surgery Appointment attribute type.");
                            throw new Error("Missing Surgery Appointment attribute type");
                        }

                        // Continue exactly as before...
                        let phone_number = phoneResponse?.data[0]?.value || null;
                        if (phone_number != null && phone_number.startsWith("0")) {
                            phone_number = "+251" + phone_number.slice(1);
                        }

                        const filteredProcedure = $scope.procedures.find(procedure => procedure.procedureName === $scope.selectedProcedure);
                        const procedureId = filteredProcedure ? filteredProcedure.procedureId : null;
                        const categoryId = $scope.selectedCatagory?.[0]?.categoryId || null;
                        var physicanFullName = '';

                        var deferrable = $q.defer();
                        var currentUser = $bahmniCookieStore.get(Bahmni.Common.Constants.currentUser);
                        if (!currentUser) {
                            this.destroy().finally(function () {
                                $rootScope.$broadcast('event:auth-loginRequired');
                                deferrable.reject("No User in session. Please login again.");
                            });
                            return deferrable.promise;
                        }

                        await userService.getUser(currentUser).then(function (data) {
                            const personName = data.results[0].person.personName;
                            const givenName = personName.givenName || '';
                            const middleName = personName.middleName || '';
                            const familyName = personName.familyName || '';

                            physicanFullName = `${givenName} ${middleName} ${familyName}`.trim().replace(/\s+/g, ' ');
                            $scope.physicianName = physicanFullName

                            $scope.physicianUuid = data.results[0].person.uuid;
                        });


                        const payload = {
                            mrn: $scope.patient.identifier,
                            fullname: $scope.patient.name,
                            phone_number: phone_number,
                            sex: $scope.patient.gender,
                            age: $scope.patient.age,
                            appointmentNote: $scope.appointmentNote.value,
                            surgery_status: "WAITING",
                            procedureId: procedureId,
                            diagnosis: $scope.diagnosis.name,
                            physican: $scope.physicianName,
                            physican_uuid: $scope.physicianUuid,
                            sent_from:$scope.physicianDepartment,
                            paymentType:$scope.patient.PaymentMethod.value.display,
                            uuid:$scope.patient.uuid,
                            region: $scope.patient.address.stateProvince
                        };
    
                        return electiveSurgeryService.createAppointment(payload);
                    })
                    .then((r) => {
                        messagingService.showMessage("info", "Appointed Patient Successfully");
                        return $scope.linkToAnesthesia($scope?.$parent?.activeVisit, r.data?.appointment?.appointmentId);
                    })
                    .catch(error => {
                        console.error("Elective Surgery Appointment Error:", error);
                        messagingService.showMessage("error", error.message || "Failed to process appointment");
                    });
            }

            var selectedDisposition = getSelectedDisposition();
            if (selectedDisposition) {
                consultation.disposition = selectedDisposition;
            } else {
                if (consultation.disposition) {
                    consultation.disposition.voided = true;
                    consultation.disposition.voidReason = "Cancelled during encounter";
                }
            }
        };
    
        var getCurrLoceUuid = function (vUuid) {
            var params = {
                q: "bahmni.sqlGet.currLocVisitAttribute",
                vUuid: vUuid
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        $scope.link = function(selectedVisitType){
            var selectedVisit= _.filter($scope.visitType, function (visitType) {
                return visitType.display === selectedVisitType;
            });
            if(selectedVisit.length > 0) {
                getCurrLoceUuid($scope.$parent.activeVisit.uuid).then(function(r){
                    var attributes = {attributes: [{value :selectedVisit[0].uuid, attributeType:r.data[0].uuid}]}; 
                    visitService.updateLocation($scope.$parent.activeVisit.uuid, attributes).then(function (response) {
                        messagingService.showMessage('info', 'Moved Patient Successful');
                    });
                })
            }
        }

        var getLinkageUuid = function () {
            var params = {
                q: "bahmni.sqlGet.linkageUuid"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };


        var getSurgeryAppointmentAttributeTypeUuids = function () {
            var params = {
                q: "bahmni.sqlGet.Surgery_AppointmentUuid"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        }

        $scope.linkToAnesthesia = function (activeVisit, appointmentId) {
            return getSurgeryAppointmentAttributeTypeUuids()
                .then(function (attributeTypeResponse) {
                    if (!attributeTypeResponse.data || !attributeTypeResponse.data[0]) {
                        messagingService.showMessage('error', 'Could not find Surgery Appointment attribute type.');
                        return Promise.reject('Missing Surgery Appointment attribute type');
                    }

                    var surgeryAppointmentAttrTypeUuid = attributeTypeResponse.data[0].uuid;
                    var selectedVisit = _.filter($scope.visitType, function (visitType) {
                        return visitType.name === "Anesthesia OPD";
                    });

                    if (selectedVisit.length === 0) {
                        messagingService.showMessage('error', 'No visit type found for linking.');
                        return Promise.reject('No visit type found for linking.');
                    }

                    return getLinkageUuid().then(function (r) {
                        if (!r.data || !r.data[0]) {
                            messagingService.showMessage('error', 'Could not find linkage UUID.');
                            return Promise.reject('Missing linkage UUID');
                        }

                        var visitDetails = {
                            patient: $scope.patient.uuid,
                            visitType: selectedVisit[0].uuid,
                            location: r.data[0].visitLocationUuid,
                            attributes: [
                                {
                                    value: activeVisit.visitType.uuid,
                                    attributeType: r.data[0].uuid
                                },
                                {
                                    attributeType: surgeryAppointmentAttrTypeUuid,
                                    value: appointmentId.toString()
                                }
                            ]
                        };
                        visitService.endVisit(activeVisit.uuid);
                        return visitService.createVisit(visitDetails).then(function () {
                            messagingService.showMessage('info', 'Patient linkage completed successfully.');
                        });
                    });
                })
                .catch(function (error) {
                    console.error('Error linking to Anesthesia:', error);
                    messagingService.showMessage('error', 'Failed to link patient to Anesthesia OPD.');
                });
        };

        function parseDiagnosis(input) {
            if (typeof input !== 'string') {
                input = String(input); // Convert input to a string if it's not already
            }
            const match = input.match(/-\s*(.+)$/);
            return match ? match[1].trim() : null;
        }

        $scope.$watch('replicaAppointmentNote.value', function (newValue) {
            if (newValue !== undefined) {
                $scope.$applyAsync(() => {
                    $scope.appointmentNote.value = newValue;
                });
            }
        });


        $scope.consultation.preSaveHandler.register("dispositionSaveHandlerKey", saveDispositions);
        $scope.$on('$destroy', saveDispositions);
       

    }])
    
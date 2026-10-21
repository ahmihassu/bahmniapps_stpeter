"use strict";

angular
  .module("bahmni.registration")

  .controller("NursingController", [
    "$window",
    "$scope",
    "$rootScope",
    "$state",
    "$bahmniCookieStore",
    "patientService",
    "encounterService",
    "$stateParams",
    "spinner",
    "$timeout",
    "$q",
    "appService",
    "openmrsPatientMapper",
    "contextChangeHandler",
    "messagingService",
    "sessionService",
    "visitService",
    "$location",
    "$translate",

    "auditLogService",
    "formService",
    "observationsService",
    "ngDialog",
    "$http",
    "conceptSetService",
    "$cookies",

    function (
      $window,
      $scope,
      $rootScope,
      $state,
      $bahmniCookieStore,
      patientService,
      encounterService,
      $stateParams,
      spinner,
      $timeout,
      $q,
      appService,
      openmrsPatientMapper,
      contextChangeHandler,
      messagingService,
      sessionService,
      visitService,
      $location,
      $translate,
      auditLogService,

      formService,
      observationsService,
      ngDialog,
      $http,
      conceptSetService,
      $cookies
    ) {
      var vm = this;

      var patientUuid = $stateParams.patientUuid;

      var extensions = appService
        .getAppDescriptor()
        .getExtensions(
          "org.bahmni.registration.conceptSetGroup.observations",
          "seccrconfig"
        );

      var formExtensions = appService
        .getAppDescriptor()
        .getExtensions(
          "org.bahmni.registration.conceptSetGroup.observations",
          "seccrforms"
        );

      var locationUuid = sessionService.getLoginLocationUuid();

      var loginLocationUuid = $bahmniCookieStore.get(
        Bahmni.Common.Constants.locationCookieName
      ).uuid;

      var defaultVisitType =
        $rootScope.regEncounterConfiguration.getDefaultVisitType(
          loginLocationUuid
        );

      defaultVisitType =
        defaultVisitType ||
        appService.getAppDescriptor().getConfigValue("defaultVisitType");

      var selectedProvider = $rootScope.currentProvider;
      console.log("Tell me that you seeeee them",$scope)
      var regEncounterTypeUuid =
        $rootScope.regEncounterConfiguration.encounterTypes[
          Bahmni.Registration.Constants.nursingTriageEncounterType
        ];

      var visitLocationUuid = $rootScope.visitLocation;

      var testNameNursingForms = "Nursing forms";

      var allConceptSections = [];

      var numberOfLevels = 2;

      var fields = [
        "uuid",
        "name:(name,display)",
        "names:(uuid,conceptNameType,name)",
      ];

      var customRepresentation =
        Bahmni.ConceptSet.CustomRepresentationBuilder.build(
          fields,
          "setMembers",
          numberOfLevels
        );

      $scope.toggleNurseForms = false;

      $scope.toggleSTForms = false;

      $scope.noOfPatients = 0;

      var getPatient = function () {
        var deferred = $q.defer();

        patientService.get(patientUuid).then(function (openMRSPatient) {
          deferred.resolve(openMRSPatient);

          $scope.patient = openmrsPatientMapper.map(openMRSPatient);

          $scope.patient.name = openMRSPatient.patient.person.names[0].display;

          $scope.patient.uuid = openMRSPatient.patient.uuid;

          $scope.patient.identifier =
            openMRSPatient.patient.identifiers[0].identifier;
        });

        return deferred.promise;
      };

      // inside your existing controller
// Initialize search and pinned concepts
$scope.conceptSearch = ''; // This matches the HTML ng-model

// Initialize pinned concepts from cookies
$scope.pinnedConcepts = [];
try {
    var cookieData = $cookies.get('pinnedConcepts');
    if (cookieData) {
        $scope.pinnedConcepts = JSON.parse(cookieData);
    }
} catch (e) {
    console.error('Error reading pinned concepts from cookie:', e);
    $scope.pinnedConcepts = [];
}

// Check if a concept is pinned
$scope.isPinned = function(conceptName) {
    return $scope.pinnedConcepts.includes(conceptName);
};

// Get pinned concepts (for the pinned section)
$scope.getPinnedConcepts = function() {
    if (!$scope.nursingConceptNames) return [];
    
    // Filter to only include pinned concepts that exist in nursingConceptNames
    var filteredPinned = $scope.pinnedConcepts.filter(function(pinnedName) {
        return $scope.nursingConceptNames.includes(pinnedName);
    });
    
    // If searching, filter by search term
    if ($scope.conceptSearch) {
        return filteredPinned.filter(function(pinnedName) {
            return pinnedName.toLowerCase().includes($scope.conceptSearch.toLowerCase());
        });
    }
    return filteredPinned;
};

// Toggle pin status
$scope.togglePin = function(conceptName) {
    var index = $scope.pinnedConcepts.indexOf(conceptName);
    
    if (index === -1) {
        // Pin the concept
        $scope.pinnedConcepts.push(conceptName);
        console.log('Pinned:', conceptName);
    } else {
        // Unpin the concept
        $scope.pinnedConcepts.splice(index, 1);
        console.log('Unpinned:', conceptName);
    }
    
    // Save to cookie
    try {
        var expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1); // 1 year from now
        $cookies.put('pinnedConcepts', JSON.stringify($scope.pinnedConcepts), {
            expires: expires,
            path: '/'
        });
        console.log('Saved to cookie:', $scope.pinnedConcepts);
    } catch (e) {
        console.error('Error saving to cookie:', e);
    }
    
    // Force Angular to update the view
    if (!$scope.$$phase) {
        $scope.$apply();
    }
};

      var formData = async function (
        type,
        patientUui,
        numberOfVisits,
        formGroup,
        patientProgramUuid
      ) {
        var params = {
          s: type,

          patient: patientUui,

          numberOfVisits: numberOfVisits,

          v: "full",

          conceptNames: formGroup || null,

          patientProgramUuid: patientProgramUuid || null,
        };

        return $http.get(Bahmni.Common.Constants.formDataUrl, {
          params: params,
        });
      };

      var getActiveEncounter = function () {
        var deferred = $q.defer();

        encounterService
          .find({
            patientUuid: patientUuid,

            providerUuids: !_.isEmpty($scope.currentProvider.uuid)
              ? [$scope.currentProvider.uuid]
              : null,

            includeAll: false,

            locationUuid: locationUuid,

            encounterTypeUuids: [regEncounterTypeUuid],
          })
          .then(function (response) {
            deferred.resolve(response);

            $scope.encounterUuid = response.data.encounterUuid;

            $scope.observations = response.data.observations;
          });

        return deferred.promise;
      };

      $scope.selectConceptSet = function (conceptLabel) {
        var selectedConceptSet = $scope.availableConceptSets.filter(function (
          conceptSet
        ) {
          return conceptSet.label == conceptLabel;
        });

        return selectedConceptSet;
      };

      var getAllForms = function () {
        var deferred = $q.defer();

        formService
          .getFormList($scope.encounterUuid)

          .then(function (response) {
            $scope.conceptSets = extensions.map(function (extension) {
              return new Bahmni.ConceptSet.ConceptSetSection(
                extension,
                $rootScope.currentUser,
                {},
                [],
                {}
              );
            });

            $scope.observationForms = getObservationForms(
              formExtensions,
              response.data
            );

            $scope.conceptSets = $scope.conceptSets.concat(
              $scope.observationForms
            );

            $scope.availableConceptSets = $scope.conceptSets.filter(function (
              conceptSet
            ) {
              return (
                conceptSet.isAvailable($scope.context) &&
                conceptSet.label == testNameNursingForms
              );
            });

            deferred.resolve(response.data);
          });

        return deferred.promise;
      };

      $scope.hideFields = appService
        .getAppDescriptor()
        .getConfigValue("hideFields");

      $scope.updatePatientImage = function (image) {
        var updateImagePromise = patientService.updateImage(
          $scope.patient.uuid,
          image.replace("data:image/jpeg;base64,", "")
        );

        spinner.forPromise(updateImagePromise);

        return updateImagePromise;
      };

      var save = function () {
        $scope.encounter = {
          patientUuid: $scope.patient.uuid,

          locationUuid: locationUuid,

          encounterTypeUuid: regEncounterTypeUuid,

          orders: [],

          drugOrders: [],

          extensions: {},
        };

        $bahmniCookieStore.put(
          Bahmni.Common.Constants.grantProviderAccessDataCookieName,
          selectedProvider,
          {
            path: "/",

            expires: 1,
          }
        );

        $scope.encounter.observations = $scope.observations;

        $scope.encounter.observations =
          new Bahmni.Common.Domain.ObservationFilter().filter(
            $scope.encounter.observations
          );

        addFormObservations($scope.encounter.observations);

        var createPromise = encounterService.create($scope.encounter);

        spinner.forPromise(createPromise);

        return createPromise
          .then(function (response) {
            var messageParams = {
              encounterUuid: response.data.encounterUuid,
              encounterType: response.data.encounterType,
            };

            auditLogService.log(
              patientUuid,
              "EDIT_ENCOUNTER",
              messageParams,
              "MODULE_LABEL_REGISTRATION_KEY"
            );

            var visitType, visitTypeUuid;

            visitService.getVisitType().then(function (response) {
              visitType = _.find(response.data.results, function (type) {
                if (type.uuid === visitTypeUuid) {
                  return type;
                } else {
                  return $scope.visitTypeUuid;
                }
              });
            });
          })
          .catch(function (error) {
            console.log(error);
          });
      };

      var isUserPrivilegedToCloseVisit = function () {
        var applicablePrivs = [
          Bahmni.Common.Constants.closeVisitPrivilege,
          Bahmni.Common.Constants.deleteVisitsPrivilege,
        ];

        var userPrivs = _.map(
          $rootScope.currentUser.privileges,
          function (privilege) {
            return privilege.name;
          }
        );

        return _.some(userPrivs, function (privName) {
          return _.includes(applicablePrivs, privName);
        });
      };

      var searchActiveVisitsPromise = function () {
        return visitService
          .search({
            patient: patientUuid,
            includeInactive: false,
            v: "custom:(uuid,location:(uuid))",
          })
          .then(function (response) {
            var results = response.data.results;

            var activeVisitForCurrentLoginLocation;

            if (results) {
              activeVisitForCurrentLoginLocation = _.filter(
                results,
                function (result) {
                  return result.location.uuid === visitLocationUuid;
                }
              );
            }

            var hasActiveVisit = activeVisitForCurrentLoginLocation.length > 0;

            vm.visitUuid = hasActiveVisit
              ? activeVisitForCurrentLoginLocation[0].uuid
              : "";

            $scope.canCloseVisit =
              isUserPrivilegedToCloseVisit() && hasActiveVisit;
          });
      };

      $scope.getMessage = function () {
        return $scope.message;
      };

      var isObservationFormValid = function () {
        var valid = true;

        _.each($scope.observationForms, function (observationForm) {
          if (valid && observationForm.component) {
            var value = observationForm.component.getValue();

            if (value.errors) {
              messagingService.showMessage(
                "error",
                "{{'REGISTRATION_FORM_ERRORS_MESSAGE_KEY' | translate }}"
              );

              valid = false;
            }
          }
        });

        return valid;
      };

      var validate = function () {
        var isFormValidated = mandatoryValidate();

        var deferred = $q.defer();

        var contxChange = contextChangeHandler.execute();

        var allowContextChange = contxChange["allow"];

        var errorMessage;

        if (!isObservationFormValid()) {
          deferred.reject("Some fields are not valid");

          return deferred.promise;
        }

        if (!allowContextChange) {
          errorMessage = contxChange["errorMessage"]
            ? contxChange["errorMessage"]
            : "REGISTRATION_LABEL_CORRECT_ERRORS";

          messagingService.showMessage("error", errorMessage);

          deferred.reject("Some fields are not valid");

          return deferred.promise;
        } else if (!isFormValidated) {
          // This ELSE IF condition is to be deleted later.

          errorMessage = "REGISTRATION_LABEL_ENTER_MANDATORY_FIELDS";

          messagingService.showMessage("error", errorMessage);

          deferred.reject("Some fields are not valid");

          return deferred.promise;
        } else {
          deferred.resolve();

          return deferred.promise;
        }
      };

      var mandatoryConceptGroup = [];

      var mandatoryValidate = function () {
        conceptGroupValidation($scope.observations);

        return isValid(mandatoryConceptGroup);
      };

      var conceptGroupValidation = function (observations) {
        var concepts = _.filter(observations, function (observationNode) {
          return isMandatoryConcept(observationNode);
        });

        if (!_.isEmpty(concepts)) {
          mandatoryConceptGroup = _.union(mandatoryConceptGroup, concepts);
        }
      };

      var isMandatoryConcept = function (observation) {
        if (!_.isEmpty(observation.groupMembers)) {
          conceptGroupValidation(observation.groupMembers);
        } else {
          return (
            observation.conceptUIConfig && observation.conceptUIConfig.required
          );
        }
      };

      var isValid = function (mandatoryConcepts) {
        var concept = mandatoryConcepts.filter(function (mandatoryConcept) {
          if (mandatoryConcept.hasValue()) {
            return false;
          }

          if (
            mandatoryConcept instanceof Bahmni.ConceptSet.Observation &&
            mandatoryConcept.conceptUIConfig &&
            mandatoryConcept.conceptUIConfig.multiSelect
          ) {
            return false;
          }

          if (mandatoryConcept.isMultiSelect) {
            return _.isEmpty(mandatoryConcept.getValues());
          }

          return !mandatoryConcept.value;
        });

        return _.isEmpty(concept);
      };

      // End :: Registration Page validation

      var afterSave = function () {
        // var forwardUrl = appService.getAppDescriptor().getConfigValue("afterVisitSaveForwardUrl");

          $window.location.href = appService
          .getAppDescriptor()
          .formatUrl("../nursing", { patientUuid: patientUuid });

        messagingService.showMessage("info", "REGISTRATION_LABEL_SAVED");
      };

      var saver = function () {
        return save().then(afterSave);
      };

      var actualSubmit = function () {
        return validate().then(saver);
      };

      $scope.submit = function () {
        // if($location.url().includes("fromSch=true")) {

        //     $scope.startVisits()

        // }

        // else{

        //     return validate().then(saver)

        // }

        return validate().then(saver);
      };

      $scope.visitControl = new Bahmni.Common.VisitControl(
        $rootScope.regEncounterConfiguration.getVisitTypesAsArray(),

        defaultVisitType,
        encounterService,
        $translate,
        visitService
      );

      $scope.startVisit = async function (selectedVisit) {
        var noOfPatients = 0;

        if (selectedVisit != undefined) {
          selectedVisit = selectedVisit.split(" --- ");

          $scope.selectedVisitType = $scope.visitControl.visitTypes.filter(
            function (visitType) {
              return visitType.name === selectedVisit[0];
            }
          )[0];

          noOfPatients = await getActivePatients();

          if (noOfPatients < 1000) {
            if (vm != undefined) {
              visitService
                .getVisitSummary(vm.visitUuid)
                .then(function (response) {
                  var visitSummary = response.data;

                  //Close the Central Triage Visit

                  visitService.endVisit(vm.visitUuid).then(function () {
                    var messageParams = {
                      visitUuid: visitSummary.visitUuid,
                      visitType: visitSummary.visitType,
                    };

                    auditLogService.log(
                      patientUuid,
                      "CLOSE_VISIT",
                      messageParams,
                      "MODULE_LABEL_REGISTRATION_KEY"
                    );

                    //Start the new selected Visit

                    $scope.visitControl.startVisit($scope.selectedVisitType);

                    var visitDetails = {
                      patient: patientUuid,
                      visitType: $scope.selectedVisitType.uuid,
                      location: visitLocationUuid,
                    };

                    visitService
                      .createVisit(visitDetails)
                      .then(function (response) {});
                  });
                });
            }

            ngDialog.close();

            actualSubmit();
          } else {
            //Pop up when the number exceed

            ngDialog.close();

            $scope.noOfPatients = noOfPatients;

            $scope.exceededPatienPopupHandler();
          }

          ngDialog.close();
        }
      };

      $scope.saveConfirmation = function () {
        // closeVisit(); //Close the Visit

        $scope.visitControl.startVisit($scope.selectedVisitType);

        var visitDetails = {
          patient: patientUuid,
          visitType: $scope.selectedVisitType.uuid,
          location: visitLocationUuid,
        };

        visitService.createVisit(visitDetails).then(function (response) {});

        ngDialog.close();

        actualSubmit();
      };

      $scope.cancel = function () {
        ngDialog.close();
      };

      $scope.today = function () {
        return new Date();
      };

      $scope.disableFormSubmitOnEnter = function () {
        $(".visit-patient")
          .find("input")
          .keypress(function (e) {
            if (e.which === 13) {
              // Enter key = keycode 13

              return false;
            }
          });
      };

      var getConceptSet = function () {
        var juicyContext = $scope.$parent.$parent;

        var location = juicyContext.currentUser.currentLocation;

        $scope.visitTypeUuid =
          juicyContext.encounterConfig.visitTypes[location];

        var visitType = $scope.encounterConfig.getVisitTypeByUuid(
          $scope.visitTypeUuid
        );

        $scope.context = { visitType: visitType, patient: $scope.patient };
      };

      var getObservationForms = function (extensions, observationsForms) {
        var forms = [];

        var observations = $scope.observations || [];

        _.each(extensions, function (ext) {
          var options = {};

          var observationForm = _.find(observationsForms, function (form) {
            return (
              form.formName === options.formName ||
              form.name === options.formName
            );
          });

          if (observationForm) {
            var formUuid = observationForm.formUuid || observationForm.uuid;

            var formName = observationForm.name || observationForm.formName;

            var formVersion =
              observationForm.version || observationForm.formVersion;

            forms.push(
              new Bahmni.ObservationForm(
                formUuid,
                $rootScope.currentUser,
                formName,
                formVersion,
                observations,
                formName,
                ext
              )
            );
          }
        });

        return forms;
      };

      $scope.visitControl.onStartVisit = function () {
        $scope.startVisit($scope.visitControl.selectedVisit);
      };

      $scope.startVisits = async function () {
        var noOfPatientsPerVisit = await getPatientPerVisit();

        $scope.visitControl.visitTypes.forEach((visitType) => {
          noOfPatientsPerVisit.forEach((noOfPatientPerVisit) => {
            if (noOfPatientPerVisit.name == visitType.name) {
              visitType.patientPerVisit =
                noOfPatientPerVisit.NoOfPatientPerVisit;
            }
          });

          if (visitType.patientPerVisit == undefined) {
            visitType.patientPerVisit = 0;
          }
        });

        return validate().then($scope.startVisitPopUpHandler);
      };

      $scope.startVisitPopUpHandler = function () {
        $scope.dialog = ngDialog.open({
          template: "views/startVisitPopUp.html",

          className: "test ngdialog-theme-default",

          scope: $scope,
        });

        $("body").addClass("show-controller-back");
      };

      $scope.isFormTemplate = function (data) {
        return data.formUuid;
      };

      var addFormObservations = function (observations) {
        if ($scope.observationForms) {
          _.remove(observations, function (observation) {
            return observation.formNamespace;
          });

          _.each($scope.observationForms, function (observationForm) {
            if (observationForm.component) {
              var formObservations = observationForm.component.getValue();

              _.each(formObservations.observations, function (obs) {
                observations.push(obs);
              });
            }
          });
        }
      };

      $scope.selectTemplate = function (name) {
        $scope.selectedTemplate = name;
      };

      spinner.forPromise(
        $q
          .all([
            getPatient(),
            getActiveEncounter(),
            searchActiveVisitsPromise(),
          ])

          .then(function () {
            getAllForms().then(function () {
              $scope.nursingFormConceptSet =
                $scope.selectConceptSet(testNameNursingForms);

              getConceptSetNames(testNameNursingForms, [])
                .then(function (templateNames) {
                  $scope.nursingConceptNames = templateNames;
                })
                .catch(function (error) {
                  console.error("Error fetching nursing concept names:", error);
                });

              $scope.secondaryTriageConceptSet;

              getConceptSet();
            });
          })
      );

      $scope.ToggleForm = function (conceptLabel) {
        console.log("Ordo", conceptLabel);

        if (conceptLabel == "Nursing forms") {
          $scope.toggleNurseForms = true;

          $scope.toggleSTForms = false;
        } else {
          $scope.toggleNurseForms = false;

          $scope.toggleSTForms = true;
        }
      };

      var getConceptSetNames = function (obs_source, special_forms) {
        var name = obs_source;

        if ($state.params.programUuid !== undefined) {
          name = "Program Observation Templates";
        }

        return conceptSetService
          .getConcept({
            name: name,

            v: "custom:" + customRepresentation,
          })
          .then(function (response) {
            var allTemplates =
              response.data.results[0].setMembers.concat(special_forms);

            var templateNames = allTemplates.map(function (template) {
              return template.name.name;
            });

            return templateNames;
          });
      };
    },
  ]);

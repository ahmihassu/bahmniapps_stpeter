'use strict';

angular
    .module('registration', ['ui.router', 'bahmni.registration', 'authentication', 'bahmni.common.config',
        'bahmni.common.appFramework', 'httpErrorInterceptor', 'bahmni.common.photoCapture', 'bahmni.common.obs',
        'bahmni.common.displaycontrol.observation', 'bahmni.common.i18n', 'bahmni.common.displaycontrol.custom',
        'bahmni.common.routeErrorHandler', 'bahmni.common.displaycontrol.pivottable', 'RecursionHelper', 'ngSanitize',
        'bahmni.common.uiHelper', 'bahmni.common.domain', 'bahmni.common.queue', 'ngDialog', 'pascalprecht.translate', 'ngCookies',
        'monospaced.elastic', 'bahmni.common.displaycontrol.hint', 'bahmni.common.displaycontrol.conditionsList', 'bahmni.common.attributeTypes',
        'bahmni.common.models', 'bahmni.common.uicontrols',
        'bahmni.common.displaycontrol.diagnosis', 'bahmni.common.ethiopianDateSelector'])
    .config(['$urlRouterProvider', '$stateProvider', '$httpProvider', '$bahmniTranslateProvider', '$compileProvider', function ($urlRouterProvider, $stateProvider, $httpProvider, $bahmniTranslateProvider, $compileProvider) {
        $httpProvider.defaults.headers.common['Disable-WWW-Authenticate'] = true;
        $urlRouterProvider.otherwise('/search');

        // @if DEBUG='production'
        $compileProvider.debugInfoEnabled(false);
        // @endif

        // @if DEBUG='development'
        $compileProvider.debugInfoEnabled(true);
        // @endif

        $stateProvider
            .state('search', {
                url: '/search',
                reloadOnSearch: false,
                views: {
                    'layout': { templateUrl: 'views/layout.html', controller: 'SearchPatientController' },
                    'content@search': { templateUrl: 'views/search.html' }
                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }
            })
            .state('searchProgram', {
                url: '/patient/searchProgram',
                reloadOnSearch: false,
                views: {
                    'layout': { templateUrl: 'views/layoutProgram.html', controller: 'SearchProgramController' },
                    'content@searchProgram': { templateUrl: 'views/searchProgram.html' }
                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }
            })
            .state('erSearch', {
                url: '/erSearch',
                reloadOnSearch: false,
                // template: '<h1>This is Info</h1>',
                views: {
                    'layout': { templateUrl: 'views/erTriageLayout.html', controller: 'SearchPatientController' },
                    'content@erSearch': { templateUrl: 'views/erSearch.html' }

                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }
            })
            .state('erPediSearch', {
                url: '/erPediSearch',
                reloadOnSearch: false,
                // template: '<h1>This is Info</h1>',
                views: {
                    'layout': { templateUrl: 'views/erPediTriageLayout.html', controller: 'SearchPatientController' },
                    'content@erPediSearch': { templateUrl: 'views/erPediSearch.html' }

                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }
            })
            .state('crSearch', {
                url: '/crSearch',
                reloadOnSearch: false,
                // template: '<h1>This is Info</h1>',
                views: {
                    'layout': { templateUrl: 'views/crTriageLayout.html', controller: 'SearchPatientController' },
                    'content@crSearch': { templateUrl: 'views/crSearch.html' }

                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }
            })
            .state('newpatient', {
                url: '/patient/new',
                views: {
                    'layout': { templateUrl: 'views/layout.html', controller: 'CreatePatientController' },
                    'content@newpatient': { templateUrl: 'views/newpatient.html' }
                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }
            })
            .state('triagePatientDashboard', {
                url: '/patient/triagePatient',
                views: {
                    'layout': { templateUrl: 'views/triageDashboardLayout.html', controller: 'TriageDashboardController' },
                    'content@triagePatientDashboard': { templateUrl: 'views/triageDashboard.html' }
                },
                data: {
                    extensionPointId: 'org.bahmni.registration.triage.dashboard'
                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                },

            })
            .state('newERTriagePatient', {
                url: '/patient/newERTriage',
                views: {
                    'layout': { templateUrl: 'views/erTriageLayout.html', controller: 'CreateERTriagePatientController' },
                    'content@newERTriagePatient': { templateUrl: 'views/newERTriagePatient.html' }
                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }
            })
            .state('newERPedTriagePatient', {
                url: '/patient/newERPTriage',
                views: {
                    'layout': { templateUrl: 'views/erPediTriageLayout.html', controller: 'CreateERPTriagePatientController' },
                    'content@newERPedTriagePatient': { templateUrl: 'views/newERPediTriagePatient.html' }
                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }
            })
            .state('newCRTriagePatient', {
                url: '/patient/newCRTriage',
                views: {
                    'layout': { templateUrl: 'views/crTriageLayout.html', controller: 'CreateCRTriagePatientController' },
                    'content@newCRTriagePatient': { templateUrl: 'views/newCRTriagePatient.html' }
                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }

            })
            .state('serviceAudit', {
                url: '/serviceAudit',
                views: {
                    'layout': { templateUrl: 'views/serviceAudit.html', controller: 'ServiceAuditController' },
                    'content@serviceAudit': { templateUrl: 'views/serviceAuditLayout.html' }
                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }

            })
            .state('medicoLegal', {
                url: '/medicoLegal',
                views: {
                    'layout': { templateUrl: 'views/medicoLegal.html', controller: 'MedicoLegalController' }
                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }

            })
            .state('patient', {
                url: '/patient/:patientUuid',
                abstract: true,
                views: {
                    'layout': { template: '<div ui-view="layout"></div>' }
                },
                resolve: {
                    initialize: function (initialization) {
                        return initialization();
                    }
                }
            })
            .state('patient.edit', {
                url: '?serverError',
                views: {
                    'layout': { templateUrl: 'views/layout.html', controller: 'EditPatientController' },
                    'content@patient.edit': { templateUrl: 'views/editpatient.html' },
                    'headerExtension@patient.edit': { template: '<div print-options></div>' }
                }
            })
            .state('patient.visit', {
                url: '/visit',
                views: {
                    'layout': { templateUrl: 'views/layout.html', controller: 'VisitController' },
                    'content@patient.visit': { templateUrl: 'views/visit.html' },
                    'headerExtension@patient.visit': { template: '<div print-options></div>' }
                }
            })
            .state('patient.erTriageVisit', {
                url: '/erTriageVisit/{triageType}',
                views: {
                    'layout': { templateUrl: 'views/erTriageLayout.html', controller: 'ERTriageVisitController' },
                    'content@patient.erTriageVisit': { templateUrl: 'views/erTriageVisit.html' },
                    'headerExtension@patient.erTriageVisit': { template: '<div print-options></div>' }
                }
            })
            .state('patient.erPediTriageVisit', {
                url: '/erPediTriageVisit/{triageType}',
                views: {
                    'layout': { templateUrl: 'views/erPediTriageLayout.html', controller: 'ERPTriageVisitController' },
                    'content@patient.erPediTriageVisit': { templateUrl: 'views/erPediTriageVisit.html' },
                    'headerExtension@patient.erPediTriageVisit': { template: '<div print-options></div>' }
                }
            })
            .state('patient.crTriageVisit', {
                url: '/crTriageVisit/{triageType}',
                views: {
                    'layout': { templateUrl: 'views/crTriageLayout.html', controller: 'CRTriageVisitController' },
                    'content@patient.crTriageVisit': { templateUrl: 'views/crTriageVisit.html' },
                    'headerExtension@patient.crTriageVisit': { template: '<div print-options></div>' }
                }
            })
            .state('patient.lab', {
                url: '/lab',
                views: {
                    'layout': {templateUrl: 'views/labLayout.html', controller: 'LabController'},
                    'content@patient.lab': {templateUrl: 'views/lab.html'}
                }
            })
            .state('patient.nursingtriage', {
                url: '/nursingtriage',
                views: {
                    'layout': {templateUrl: 'views/labLayoutNursing.html', controller: 'NursingController'},
                    'content@patient.nursingtriage': {templateUrl: 'views/nursing.html'}
                }
            })
            .state('availability', {
                url: '/avail',
                views: {
                    'layout': { templateUrl: 'views/availability.html', controller: 'availabilityController' },
                    'content@availability': { templateUrl: 'views/availability.html' }
                }
            })
            .state('patient.printSticker', {
                url: '/printSticker',
                views: {
                    'layout': { templateUrl: 'views/layout.html' },
                    'content@patient.printSticker': { templateUrl: 'views/notimplemented.html' }
                }
            });
        $bahmniTranslateProvider.init({ app: 'registration', shouldMerge: true });
    }]).run(['$rootScope', '$templateCache', '$bahmniCookieStore', 'locationService', 'messagingService', 'auditLogService',
        '$window', function ($rootScope, $templateCache, $bahmniCookieStore, locationService,
            messagingService, auditLogService, $window) {
            var getStates = function (toState, fromState) {
                var states = [];
                if (fromState === "newpatient" && (toState === "patient.edit" || toState === "patient.visit")) {
                    states.push("newpatient.save");
                }
                if (toState === 'patient.edit') {
                    states.push("patient.view");
                } else {
                    states.push(toState);
                }
                return states;
            };
            moment.locale($window.localStorage["NG_TRANSLATE_LANG_KEY"] || "en");
            var loginLocationUuid = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid;
            locationService.getVisitLocation(loginLocationUuid).then(function (response) {
                if (response.data) {
                    $rootScope.visitLocation = response.data.uuid;
                }
            });

            $rootScope.$on('$stateChangeStart', function () {
                messagingService.hideMessages("error");
            });

            $rootScope.createAuditLog = function (event, toState, toParams, fromState) {
                var states = getStates(toState.name, fromState.name);
                states.forEach(function (state) {
                    auditLogService.log(toParams.patientUuid, Bahmni.Registration.StateNameEvenTypeMap[state], undefined, "MODULE_LABEL_REGISTRATION_KEY");
                });
            };

            $rootScope.$on('$stateChangeSuccess', $rootScope.createAuditLog);
        }
    ]);

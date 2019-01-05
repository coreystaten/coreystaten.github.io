function capitalise(string)
{
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function InventoryController($rootScope, $scope, dialog) {
    $scope.__proto__ = $rootScope.cheat;
    $scope.closeInventoryDialog = function () {
        dialog.close();
    };
}

var combatModule = angular.module('combatModule', ['ui.bootstrap', 'ngSanitize']).
    directive('progressBar', function factory() {
        return function link(scope, elt, attr) {
            var progressRatio;

            function updateBar() {
                elt.progressbar('value', progressRatio);
            }

            scope.$watch(attr.progressBar, function (value) {
                progressRatio = value;
                updateBar();
            });

            elt.progressbar({max: 1, value: 0});
        }
    }).
    directive('npc', function factory() {
        return {
            template: '<div class="box npc-box">' +
                    '<progress percent="100 * npc.health / npc.maxHealth" class="npc-health-bar progress-danger"></progress>' +
                    '<div class="row-fluid">' +
                        '<b ng-bind="npc.name"></b>&nbsp;&nbsp;&nbsp;' +
                        '<span ng-bind="npc.health"></span> / <span ng-bind="npc.maxHealth"></span> ' +
                        '<div class="hostile-display" ng-show="npc.hostile" ng-animate="\'fade-in\'">(HOSTILE)</div>' +
                        '<div class="target-display" ng-show="npc.targeted" ng-animate="\'grow-in\'">(TARGETED)</div>' +                        
                    '</div>' +
                '</div>',
            replace: true,
            link: function link(scope, elt, attrs) {
                elt.click(function () {
                    scope.$apply(function () {
                        scope.targetNpc(scope.npc);
                    });
                });
            }
        }
    }).
    directive('message', function factory() {
        return function link(scope, elt, attr) {
            var messageObj;
            scope.$watch(attr.message, function (value) {
                messageObj = value;
                elt.text(value.text);
            });

            elt.animate({opacity: 0}, 10000, function () {
                if (messageObj) {
                    scope.$apply(function () {
                        scope.removeMessage(messageObj);
                    });
                }
            });
        }
    }).
    directive('actionButton', function factory() {
        return {
            template: '<span class="box action-button" ng-click="tryAction()">' +
                    '<div class="action-button-cooldown" style="width: {{cooldownPercent}}%"></div>' +
                    '<span ng-transclude></span>' +
                '</span>',
            replace: true,
            transclude: true,
            restrict: 'E',
            scope: true,
            link: function link(scope, elt, attrs) {
                attrs.enabled = attrs.enabled || "true";
                attrs.actionTime = attrs.actionTime || "[0,0]";
                scope.tryAction = function () {
                    if (scope.actionTime[0] === 0 && scope.enabled) {
                        scope.$eval(attrs.action);
                    }
                };

                scope.$watch(attrs.actionTime, function (value) {
                    value = value || [0,0];
                    scope.actionTime = value;
                    if (value[0] <= 0) {
                        elt.removeClass("action-button-waiting");
                    }
                    else {
                        elt.addClass("action-button-waiting");
                    }

                    if (value[1] !== 0) {
                        scope.cooldownPercent = 100 * value[0] / value[1];
                    }
                    else {
                        scope.cooldownPercent = 0;
                    }
                }, true);

                scope.$watch(attrs.enabled, function (value) {
                    scope.enabled = value;
                    if (value) {
                        elt.removeClass("action-button-disabled");
                    }
                    else {
                        elt.addClass("action-button-disabled");
                    }
                });
            }
        }
    }).
    directive('dynamicTemplate', function ($compile) {
        return {
            link: function (scope, elt, attrs) {
                var templateEl;

                scope.$watch(attrs.template, function (template) {
                    templateEl = $compile(template)(scope);
                    elt.html(templateEl);
                });
            }
        };
    }).
    controller('CombatController', ['$scope', '$timeout', '$dialog', '$rootScope', function($scope, $timeout, $dialog, $rootScope) {
        // Terrible global state hack for modal.
        $rootScope.cheat = $scope;

        // Item types by ID
        $scope.itemTypes = {
            'arrogance': {
                id: 'arrogance',
                name: 'arrogance',
                plural: 'arrogances',
                max: 1,
                actions: []
            },
            'silver-dubloon': {
                id: 'silver-dubloon',
                name: 'a silver dubloon',
                plural: 'silver dubloons',
                max: 1000000,
                actions: []
            },
            'healing-liquor': {
                id: 'healing-liquor',
                name: 'a healing liquor',
                plural: 'healing liquors',
                cost: 100,
                actions: [{
                    description: 'Drink',
                    action: function() {
                        var healing = 20 + Math.random() * 20;
                        healing = Math.min(healing, $scope.gameState.player.maxHealth - $scope.gameState.player.health);
                        $scope.addMessage('You quaff the healing liquor, restoring ' + healing + ' health.');
                        $scope.reduceInventory('healing-liquor', 1);
                    }
                }]
            },
            'temporary-hammer-of-smiting': {
                id: 'temporary-hammer-of-smiting',
                name: 'a temporary hammer of smiting',
                plural: 'temporary hammers of smiting',
                cost: 500,
                actions: [{
                    description: 'Start Smiting',
                    action: function() {
                        $scope.addMessage("You become more smitey (temporarily).");
                        $scope.gameState.player.strength += 10;
                        $scope.reduceInventory('temporary-hammer-of-smiting', 1);
                        $timeout(function () {
                            $scope.addMessage("Your temporary smitiness evaporates.");
                            $scope.gameState.player.strength -= 10;
                        }, 60000);
                    }
                }]
            },
            'golden-jello-key': {
                id: 'golden-jello-key',
                name: 'a golden jello key',
                plural: 'golden jello keys',
                max: 1,
                actions: [{
                    description: 'Use',
                    action: function() {
                        if ($scope.gameState.area.id == 'jellofort') {
                            if ($scope.gameState.innerFortUnlocked) {
                                $scope.addMessage("That is already unlocked.");
                            }
                            else {
                                $scope.addMessage("You unlock the door to the inner jello fort.");
                                $scope.gameState.innerFortUnlocked = true;
                            }
                        }
                        else {
                            $scope.addMessage("You don't see anywhere to use the key.")
                        }
                    }
                }]
            },
            'dragon-charm': {
                id: 'dragon-charm',
                name: 'a dragon charm',
                plural: 'dragon charms',
                max: 1,
                actions: [{
                    description: "Turn into a dragon",
                    action: function() {
                        if ($scope.gameState.isDragon) {
                            $scope.addMessage("You're already a fucking dragon.");
                        }
                        else {
                            $scope.addMessage("You turn into a fucking dragon.")
                            $scope.gameState.isDragon = true;
                        }
                    }
                }]
            }
        };

        $scope.itemTypesArray = _.values($scope.itemTypes);



        // NPC prototypes.
        var jelloElemental = {
            name: "a jello elemental",
            health: 30,
            maxHealth: 30,
            armor: 0,
            attackTime: 8,
            exp: 50,
            strength: 8,
            hostile: true,
            loot: [{
                itemId: 'healing-liquor',
                probability: 0.05,
                minAmount: 1,
                maxAmount: 1
            }, {
                itemId: 'silver-dubloon',
                probability: 1,
                minAmount: 20,
                maxAmount: 40

            }],
            tick: function (self, time) {
                $scope.tickAttack(self, time);
            }
        };
        var weavelProtestor = {
            name: "a weavel protestor",
            health: 20,
            maxHealth: 20,
            armor: 0,
            attackTime: 12,
            exp: 5,
            strength: 8,
            hostile: false,
            loot: [],
            tick: function (self, time) {
                if (Math.random() < .08 * time) {
                    var guardsPresent = _.filter($scope.gameState.npcs, function (npc) { return npc.name === "a weavel guard"; }).length > 0;
                    var roll = Math.random();
                    if (roll < 0.3) {
                        $scope.addMessage("A weavel protestor tries to hand you a pamphlet about weavel communism.");
                    }
                    else if (roll < 0.7) {
                        $scope.addMessage("A weavel protestor holds up a sign reading 'Weavels Unite!'");
                    }
                    else if (guardsPresent) {
                        $scope.addMessage("A weavel guard bashes a weavel protestor into a wall.");
                        $scope.damageEntity(null, self, 1000);
                    }
                    else {
                        $scope.addMessage("A weavel protestor thanks you for fighting the system.");
                    }
                }
                $scope.tickAttack(self, time);
            }

        }
        var microSorcerer = {
            name: "a micro sorcerer",
            health: 50,
            maxHealth: 50,
            armor: 0,
            attackTime: 12,
            exp: 80,
            strength: 5,
            hostile: true,
            loot: [{
                itemId: 'silver-dubloon',
                probability: 1,
                minAmount: 40,
                maxAmount: 60

            }],
            tick: function (self, time) {
                self.timeToSummon = self.timeToSummon || (10.0 + (Math.random() * 10));
                $scope.tickAttack(self, time);

                self.timeToSummon -= time;
                if (self.timeToSummon <= 0 && $scope.gameState.npcs.length < 5) {
                    $scope.addMessage("A micro sorcerer summons a jello elemental.");
                    $scope.addNpc(_.clone(jelloElemental));
                    self.timeToSummon = (10.0 + (Math.random() * 10));
                }
            }
        };
        var macroSorcerer = {
            name: "a macro sorcerer",
            health: 120,
            maxHealth: 120,
            armor: 10,
            attackTime: 12,
            exp: 500,
            strength: 18,
            hostile: true,
            loot: [{
                itemId: "dragon-charm",
                probability: 0.3,
                minAmount: 1,
                maxAmount: 1
            }, {
                itemId: "silver-dubloon",
                probability: 1,
                minAmount: 200,
                maxAmount: 300
            }],
            tick: function (self, time) {
                self.timeToSummon = self.timeToSummon || (10.0 + (Math.random() * 10));
                $scope.tickAttack(self, time);

                self.timeToSummon -= time;
                if (self.timeToSummon <= 0 && $scope.gameState.npcs.length < 5) {
                    $scope.addMessage("A macro sorcerer summons a massive jello elemental.");
                    $scope.addNpc(_.clone(massiveJello));
                    self.timeToSummon = (10.0 + (Math.random() * 10));
                }
            }
        };
        var massiveJello = {
            name: "a massive jello elemental",
            health: 80,
            maxHealth: 80,
            armor: 10,
            attackTime: 6,
            exp: 400,
            strength: 24,
            hostile: true,
            loot: [{
                itemId: 'golden-jello-key',
                probability: 1,
                minAmount: 1,
                maxAmount: 1
            }, {
                itemId: 'silver-dubloon',
                probability: 1,
                minAmount: 100,
                maxAmount: 200
            }],
            tick: function (self, time) {
                $scope.tickAttack(self, time);
            }            
        };
        var marcCarnovale = {
            name: 'Marc Carnovale',
            health: 2000,
            maxHealth: 2000,
            armor: 45,
            attackTime: 4,
            exp: 5000,
            strength: 60,
            hostile: true,
            loot: [{
                itemId: 'arrogance',
                probability: 1,
                minAmount: 1,
                maxAmount: 1
            }],
            tick: function (self, time) {
                $scope.tickAttack(self, time);
            },
            onDeath: function () {
                $scope.addMessage("You have won the game.");
                $scope.gameState.hasWon = true;
            }
        }
        var dragon = {
            name: "a fucking dragon",
            health: 500,
            maxHealth: 500,
            armor: 25,
            attackTime: 6,
            exp: 1000,
            strength: 40,
            hostile: true,
            loot: [{
                itemId: 'silver-dubloon',
                probability: 1,
                minAmount: 5000,
                maxAmount: 5000
            }],
            tick: function (self, time) {
                $scope.tickAttack(self, time);
            },
            onDeath: function () {
                $scope.gameState.dragonDead = true;
            }
        }
        var weavelGuard = {
            name: "a weavel guard",
            health: 50,
            maxHealth: 50,
            armor: 3,
            attackTime: 8,
            exp: 150,
            strength: 15,
            hostile: false,
            tick: function (self, time) {
                $scope.tickAttack(self, time);
            }
        };

        var areas = [{
            id: 'weaveltown',
            areaTitle: 'Weavel Town',
            areaDescription: '<span>This is a town full of weavels.  There is a path to the <a href="#" ng-click="goto(\'jellofort\')">jello fortress</a>.</span>',
            tick: function (area, time) {
                var guardSpawnProb = .08;
                var protestorSpawnProb = .06;
                var guardsPresent = _.filter($scope.gameState.npcs, function(n) { return n.name === "a weavel guard"; }).length
                var isHostile = _.filter($scope.gameState.npcs, function(n) { return n.hostile === true && n.name === "a weavel guard"; }).length > 0;
                if (guardsPresent < 3) {
                    if (Math.random() < guardSpawnProb * time) {
                        var newGuard = _.clone(weavelGuard);
                        if (isHostile) {
                            newGuard.hostile = true;
                        }
                        $scope.addNpc(newGuard);
                    }
                }
                if ($scope.gameState.npcs.length < 5) {
                    if (Math.random() < protestorSpawnProb * time) {
                        $scope.addNpc(_.clone(weavelProtestor));
                    }
                }
                if (!isHostile) {
                    if ($scope.gameState.player.health < $scope.gameState.player.maxHealth) {
                        $scope.gameState.player.health += 1;                        
                    }
                }
                else {
                    _.each($scope.gameState.npcs, function (npc) {
                        if (npc.name === "a weavel guard") {
                            npc.hostile = true;                            
                        }
                    });
                }
            },
            onEnter: function (area) {
                $scope.addNpc(_.clone(weavelGuard));
                $scope.addNpc(_.clone(weavelGuard));
                $scope.addNpc(_.clone(weavelGuard));
            }
        },
        {
            id: 'jellofort',
            areaTitle: 'Jello Fortress',
            areaDescription: '<span>' +
                'This is a fortress made entirely of jello.  You stand outside. ' +
                'There is a path back to <a href="#" ng-click="goto(\'weaveltown\')">town</a>. ' +
                '<span ng-hide="gameState.innerFortUnlocked">There is a gate leading forward, but it is locked.</span>' +
                '<span ng-show="gameState.innerFortUnlocked">There is a gate leading forward to the <a href="#" ng-click="goto(\'innerfort\')">inner fort</a>.' +
                '</span>',
            tick: function (area, time) {
                var microSpawnProb = .06;
                var elementalSpawnProb = .12;
                area.massiveSpawnProb = area.massiveSpawnProb || .0;
                area.massiveSpawnProb += .001 * time;

                var probScaling =  1 + $scope.gameState.npcs.length * (3.0 / 5.0);

                if ($scope.gameState.npcs.length < 5) {
                    if (Math.random() * probScaling < microSpawnProb * time) {
                        $scope.addNpc(_.clone(microSorcerer));
                    }
                    if (Math.random() * probScaling < elementalSpawnProb * time) {
                        $scope.addNpc(_.clone(jelloElemental));
                    }
                    if (Math.random() * probScaling < area.massiveSpawnProb * time) {
                        $scope.addNpc(_.clone(massiveJello));
                        area.massiveSpawnProb = 0;
                    }
                }
            },
            onEnter: function (area) {
                area.massiveSpawnProb = 0.0;
            }
        },
        {
            id: 'innerfort',
            areaTitle: 'Inner Jello Fortress',
            areaDescription: '<span>' +
                'This is the inside of a fortress made entirely of jello.  Things are getting surreal. ' +
                'There\'s a gate leading <a href="#" ng-click="goto(\'jellofort\')">outside</a> and a ' +
                '<a href="#" ng-click="goto(\'gapingmaw\')">gaping maw</a> going into the ground.' +
                '</span>',
            tick: function (area, time) {
                var macroSpawnProb = .06;
                var massiveSpawnProb = .12;
                area.marcSpawnProb += .00005 * time;

                var probScaling =  1 + $scope.gameState.npcs.length * (3.0 / 5.0);

                if ($scope.gameState.npcs.length < 5) {
                    if (Math.random() * probScaling < macroSpawnProb * time) {
                        $scope.addNpc(_.clone(macroSorcerer));
                    }
                    if (Math.random() * probScaling < massiveSpawnProb * time) {
                        $scope.addNpc(_.clone(massiveJello));
                    }
                    if (Math.random() * probScaling < area.marcSpawnProb * time) {
                        $scope.addNpc(_.clone(marcCarnovale));
                        area.marcSpawnProb = 0;
                    }
                }
            },
            onEnter: function (area) {
                area.marcSpawnProb = 0;
            }
        },
        {
            id: 'gapingmaw',
            areaTitle: 'The Gaping Maw',
            areaDescription: '<span>' +
                'There\'s a fucking dragon here. Makes sense. ' +
                'You can still run back into the <a href="#" ng-click="goto(\'innerfort\')">jello fortress</a>.' +
                '</span>',
            tick: function (area, time) {

            },
            onEnter: function (area) {
                $scope.addNpc(_.clone(dragon));
            }
        }];


        // Initialize game state.
        $scope.gameState = {
            area: areas[0],
            npcs: [],
            inventory: {},
            player: {
                level: 1,
                health: 100,
                maxHealth: 100,
                strength: 10,
                currentExp: 0,
                expToNextLevel: 100,
                armor: 0,
                attackTime: 4,
                inventory: []
            },
            messages: [],
            nextMessageId: 0,
            nextNpcId: 0,
            targetedNpc: null,
            attackTime: [0,0]
        };

        $scope.addNpc = function(npc) {
            npc.id = $scope.gameState.nextNpcId;
            $scope.gameState.nextNpcId += 1;
            $scope.gameState.npcs.push(npc);
        }

        $scope.removeNpc = function(npc) {
            $scope.gameState.npcs = _.reject($scope.gameState.npcs, function (n) { return n.id === npc.id; });
            if (npc === $scope.gameState.targetedNpc) {
                $scope.gameState.targetedNpc = null;
            }
        }

        $scope.addMessage = function(message) {
            $scope.gameState.messages.unshift({text: message, messageId: $scope.gameState.nextMessageId});
            $scope.gameState.nextMessageId += 1;
            // Delete messages past the 20th.
            if($scope.gameState.messages.length > 20) {
                $scope.gameState.messages.splice(19, $scope.gameState.messages.length - 20);
            }
        }

        $scope.removeMessage = function(message) {
            $scope.gameState.messages = _.reject($scope.gameState.messages, function(m) { return m.messageId === message.messageId; });
        }

        $scope.targetNpc = function(npc) {
            if ($scope.gameState.targetedNpc) {
                $scope.gameState.targetedNpc.targeted = false;
            }
            npc.targeted = true;
            $scope.gameState.targetedNpc = npc;
            $scope.addMessage("You have targeted " + npc.name + ".");
        }

        $scope.attackTargetedNpc = function () {
            if ($scope.gameState.targetedNpc) {
                if (!$scope.gameState.targetedNpc.hostile) {
                    var box = $dialog.messageBox("Confirm Attack", "Are you sure you want to attack?",
                        [{result: 'cancel', label: 'Cancel'}, {result: 'confirm', label: 'Confirm', cssClass: 'btn-primary'}]);
                    box.open().then(function (result) {
                        if (result === 'confirm' && $scope.gameState.targetedNpc) {
                            $scope.gameState.targetedNpc.hostile = true;
                            $scope.attackTargetedNpc();
                        }
                    });                
                }
                else {
                    $scope.damageEntity($scope.gameState.player, $scope.gameState.targetedNpc, $scope.gameState.player.strength);
                    $scope.gameState.attackTime = [$scope.gameState.player.attackTime, $scope.gameState.player.attackTime];
                }
            }
        }

        $scope.tickAttack = function(self, time) {
            self.timeToAttack = self.timeToAttack || ((0.8 + 0.4 * Math.random()) * self.attackTime);
            self.timeToAttack -= time;
            if (self.timeToAttack <= 0) {
                var target = $scope.selectTarget(self);
                if (target !== null) {
                    $scope.damageEntity(self, target, self.strength);
                }
                self.timeToAttack = ((0.8 + 0.4 * Math.random()) * self.attackTime);
            }
        };

        $scope.selectTarget = function(npc) {
            if (npc.hostile) {
                possible = _.filter($scope.gameState.npcs, function (npc) { return !npc.hostile; });
                possible.push($scope.gameState.player);
            }
            else {
                possible = _.filter($scope.gameState.npcs, function (npc) { return npc.hostile; });
            }
            if (possible.length === 0) {
                return null;
            }
            return possible[_.random(possible.length - 1)];            
        };

        $scope.breathFire = function () {
            $scope.addMessage("You breath fire on all hostile foes.");
            var targets = _.filter($scope.gameState.npcs, function (npc) { return npc.hostile; });
            _.each(targets, function (t) {
                $scope.damageEntity($scope.gameState.player, t, 2 * $scope.gameState.player.strength);
            });
            $scope.gameState.attackTime = [2 * $scope.gameState.player.attackTime, 2 * $scope.gameState.player.attackTime];            
        };

        $scope.armorUpBuy = function () {
            $scope.addMessage("You buy some additional armor plating.");
            $scope.gameState.player.armor += 1;
            $scope.gameState.inventory['silver-dubloon'] -= 1000;
        };

        $scope.strengthUpBuy = function () {
            $scope.addMessage("You buy a gym membership for the month and spend some time lifting.");
            $scope.gameState.player.strength += 1;
            $scope.gameState.inventory['silver-dubloon'] -= 1000;
        };

        $scope.damageEntity = function(source, entity, damage) {
            critical = Math.random() < 0.15 && source;

            fluctuatedDamage = (0.75 + (Math.random() /2)) * damage;
            if (critical) {
                fluctuatedDamage *= 1.8;
            }

            adjustedDamage = fluctuatedDamage - entity.armor;
            actualDamage = Math.floor(adjustedDamage);

            if (actualDamage <= 0) {
                if (entity === $scope.gameState.player) {
                    $scope.addMessage(capitalise(source.name) + " hits you, but the attack bounces off your armor.");
                }
                else if (source === $scope.gameState.player) {
                    $scope.addMessage("Your attack bounces harmlessly off of " + entity.name + ".");                    
                }
                else if (source) {
                    $scope.addMessage(capitalise(source.name) + " hits " + entity.name + ", but the attack bounces off their armor.");
                }
                else {
                    $scope.addMessage(capitalise(entity.name) + " is hit, but shrugs off the damage.");
                }
                return;
            }
            else if (critical) {
                if (entity === $scope.gameState.player) {
                    $scope.addMessage(capitalise(source.name) + " lands a critical hit on you for " + actualDamage + " damage.");
                }
                else if (source === $scope.gameState.player) {
                    $scope.addMessage("You land a critical hit on " + entity.name + " for " + actualDamage + " damage.");                    
                }
                else {
                    $scope.addMessage(capitalise(source.name) + " lands a critical hit on " + entity.name + " for " + actualDamage + " damage.");
                }        
            }
            else {
                if (entity === $scope.gameState.player) {
                    $scope.addMessage(capitalise(source.name) + " hits you for " + actualDamage + " damage.");
                }
                else if (source === $scope.gameState.player) {
                    $scope.addMessage("You hit " + entity.name + " for " + actualDamage + " damage.");
                }
                else if (source) {
                    $scope.addMessage(capitalise(source.name) + " hits " + entity.name + " for " + actualDamage + " damage.");
                }
                else {
                    $scope.addMessage(capitalise(entity.name) + " is hit for " + actualDamage + " damage.");
                }                        
            }

            entity.health -= actualDamage;

            if (entity.health <= 0) {
                entity.health = 0;
                $scope.entityDies(entity);
                if (source === $scope.gameState.player) {
                    $scope.gainExp(entity.exp);
                    _.each(entity.loot, function (lootDesc) {
                        if (Math.random() < lootDesc.probability) {
                            var amount = _.random(lootDesc.minAmount, lootDesc.maxAmount);
                            $scope.findItem(lootDesc.itemId, amount);
                        }
                    });
                }
            }
        };

        $scope.goto = function(areaId) {
            $scope.gameState.npcs = [];
            $scope.gameState.area = _.find(areas, function (a) { return a.id === areaId; });
            $scope.gameState.targetedNpc = null;

            $scope.gameState.area.onEnter($scope.gameState.area);
        };

        $scope.entityDies = function(entity) {
            if (entity === $scope.gameState.player) {
                $scope.goto("weaveltown");
                $scope.addMessage("You died. Try again.");
                $scope.gameState.player.health = $scope.gameState.player.maxHealth;
            }
            else {
                if (entity.onDeath) {
                    entity.onDeath();                    
                }
                $scope.addMessage(capitalise(entity.name) + " dies.");
                $timeout(function() {$scope.removeNpc(entity);}, 0);
            }
        };

        $scope.gainExp = function(exp) {
            player = $scope.gameState.player;
            player.currentExp += exp;
            while (player.currentExp >= player.expToNextLevel) {
                // Level up.
                player.currentExp -= player.expToNextLevel;
                player.expToNextLevel += Math.floor(player.level * (100 + (2 * player.level)));
                player.level += 1;
                player.strength += 3
                player.maxHealth += 30
                player.health += 30;
                player.armor += 2;
                $scope.addMessage("You've reached level " + player.level + ".");
            }
        };

        $scope.increaseInventory = function (itemId, amount) {
            if (!$scope.itemTypes.hasOwnProperty(itemId)) {
                console.log("Unable to find item id " + itemId);
                return;
            }
            var maxAmount = $scope.itemTypes[itemId].max || 100;
            var oldAmount;
            if (!$scope.gameState.inventory.hasOwnProperty(itemId)) {
                oldAmount = 0;
                $scope.gameState.inventory[itemId] = Math.min(maxAmount, amount);
            }
            else {
                oldAmount = $scope.gameState.inventory[itemId];
                $scope.gameState.inventory[itemId] = Math.min(maxAmount, $scope.gameState.inventory[itemId] + amount);
            }

            return $scope.gameState.inventory[itemId] - oldAmount;
        };

        $scope.reduceInventory = function(itemId, amount) {
            if (!$scope.itemTypes.hasOwnProperty(itemId)) {
                console.log("Unable to find item id " + itemId);
                return;
            }

            if ($scope.gameState.inventory.hasOwnProperty(itemId)) {
                $scope.gameState.inventory[itemId] = Math.max(0, $scope.gameState.inventory[itemId] - amount);
            }
        };

        $scope.findItem = function(itemId, quantity) {
            var increase = $scope.increaseInventory(itemId, quantity);

            if (increase === 1) {
                $scope.addMessage('You found ' + $scope.itemTypes[itemId].name + '.');
            }
            else if (increase > 1) {
                $scope.addMessage('You found ' + quantity + ' ' + $scope.itemTypes[itemId].plural + ".");
            }
        };

        $scope.gameTick = function () {
            if ($scope.gameState.attackTime[0] !== 0) {
                $scope.gameState.attackTime[0] -= .1;
                if ($scope.gameState.attackTime[0] <= 0) {
                    $scope.gameState.attackTime = [0,0];
                }
            }
            _.each($scope.gameState.npcs, function (npc) { npc.tick(npc, 0.1); });
            $scope.gameState.area.tick($scope.gameState.area, 0.1);
            $timeout($scope.gameTick, 100);
        };

        $scope.openInventoryDialog = function () {
            var opts = {
                backdrop: true,
                keyboard: true,
                backdropClick: true,
                template:  '<div class="modal-body">'+
                      '<h3>Inventory</h3>'+
                      '<p>Search for: <input ng-model="itemSearchString" /></p>' +
                      '<div class="row-fluid"><div class="span3"><b>Item name</b></div><div class="span2"><b>Quantity</b></div><div class="span7"><b>Actions</b></div></div>' +
                      '<div ng-repeat="itemType in itemTypesArray | filter:itemSearchString">' +
                        '<div ng-show="gameState.inventory[itemType.id]" class="row-fluid">' +
                            '<div class="span3">{{itemType.name}}</div>' +
                            '<div class="span2">{{gameState.inventory[itemType.id]}}</div>' +
                            '<div ng-repeat="action in itemType.actions" class="span2">' +
                                '<action-button action="action.action()">{{action.description}}</action-button>' +
                            '</div>' +
                        '</div>' +
                      '</div>' +
                      '<div class="row-fluid"><action-button action="closeInventoryDialog()" class="span2 offset10">Close</action-button></div>' +
                      '</div>',
                controller: 'InventoryController'
            };
            $scope.invDialog = $dialog.dialog(opts);
            $scope.invDialog.open();         
        }

        $scope.buyItem = function (itemId) {
            // TODO: Error handling.
            itemType = $scope.itemTypes[itemId];
            $scope.gameState.inventory["silver-dubloon"] -= itemType.cost;
            $scope.increaseInventory(itemId, 1);
            $scope.addMessage("You buy " + itemType.name + " for " + itemType.cost + " silver dubloons.");
        }

        $timeout($scope.gameTick, 100);

        $scope.addMessage("Welcome.");
        $scope.gameState.area.onEnter($scope.gameState.area);
    }]);
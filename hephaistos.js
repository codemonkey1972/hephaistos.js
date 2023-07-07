var HephaistosImporter = HephaistosImporter || (function () {
    let sendMsg = function (msg) {
        msg = "/w gm " + msg;
        sendChat("Hephaistos Importer", msg);
    };

    let showHelp = function () {
        var text = "<b>Hephaistos Importer</b><br><i>Note: The import script is in active development. "
            + "It may be missing key features and contain bugs.</i><br><br><b>Usage:</b><br><code>!hephaistos "
            + "[option]</code><br><br><b>Options:</b><br><code>--help</code><br><span style=\"margin-left: 1rem;\">Print "
            + "this help information.</span><br><br><code>--import-character-simple {...}</code><br>"
            + "<span style=\"margin-left: 1rem;\">Import a character (and drone, if applicable) using JSON data and create a Starfinder (Simple) sheet. "
            + "You can download your character's JSON file from Hephaistos, open the file and copy the entire contents to use "
            + "for this option.</span><br><br><code>--import-starship-simple {...}</code><br><span style=\"margin-left: 1rem;\">"
            + "Import a starship using JSON data and create a Starfinder (Simple) sheet.</span><br><br><code>--import-character-roll20 {...}</code><br>"
            + "<span style=\"margin-left: 1rem;\">Import a character using JSON data and create a Starfinder (Roll20) sheet..</span><br><br>"
            + "<code>--import-starship-roll20 {...}</code><br>"
            + "<span style=\"margin-left: 1rem;\">Import a starship using JSON data and create a Starfinder (Roll20) sheet..</span>"
        sendMsg(text);
    };

    let importSpeed = function (speeds) {
        const speed = [];
        for (const [k, v] of Object.entries(speeds)) {
            switch (k) {
                case "land":
                    speed.push(`${v} ft.`);
                    break;
                case "burrow":
                    speed.push(`burrow ${v} ft.`);
                    break;
                case "swim":
                    speed.push(`swim ${v} ft.`);
                    break;
                case "climb":
                    speed.push(`climb ${v} ft.`);
                    break;
                case "flyClumsy":
                    speed.push(`fly (clumsy) ${v} ft.`);
                    break;
                case "flyAverage":
                    speed.push(`fly (average) ${v} ft.`);
                    break;
                case "flyPerfect":
                    speed.push(`fly (perfect) ${v} ft.`);
                    break;
            }
        }

        return speed.join(", ");
    }

    let splitCamelCase = function (text) {
        return text.replace(/([A-Z])/g, " $1").toLowerCase();
    }

    // Begin code from Roll20 forums
    // https://app.roll20.net/forum/post/3737514/script-chatsetattr-set-character-attributes-via-chat-messages/?pageforid=4258551#post-4258551
    let generateUUID = (function() {
            var a = 0, b = [];
            return function() {
                var c = (new Date()).getTime() + 0, d = c === a;
                a = c;
                for (var e = new Array(8), f = 7; 0 <= f; f--) {
                    e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64);
                    c = Math.floor(c / 64);
                }
                c = e.join("");
                if (d) {
                    for (f = 11; 0 <= f && 63 === b[f]; f--) {
                        b[f] = 0;
                    }
                    b[f]++;
                } else {
                    for (f = 0; 12 > f; f++) {
                        b[f] = Math.floor(64 * Math.random());
                    }
                }
                for (f = 0; 12 > f; f++){
                    c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
                }
                return c;
            };
    }());

    let generateRowID = function () {
        return generateUUID().replace(/_/g, "Z");
    };
    // End code from Roll20 forums

    let Simple = (function () {
        let findBonusOfType = function (bonuses, type) {
            const found = bonuses.find(b => b.type === type);
            if (found) {
                return found.value;
            }
            return 0;
        }

        let totalBonus = function (bonuses) {
            let uniqueBonuses = new Map();
            for (const b of bonuses) {
                if (b.type === "Misc") {
                    uniqueBonuses.set(b.source, b.value);
                    continue;
                }

                const current = uniqueBonuses.get(b.type);
                if (current) {
                    uniqueBonuses.set(b.type, Math.max(current, b.value));
                } else {
                    uniqueBonuses.set(b.type, b.value);
                }
            }

            return [...uniqueBonuses.values()].reduce((p, c) => p + c, 0);
        }

        let calculateAbilityIncreases = function (racial, theme, increasesCount) {
            let increases = 0;
            for (let i = 0; i < increasesCount; i++) {
                if (racial + theme + increases + 10 < 17) {
                    increases += 2;
                } else {
                    increases += 1;
                }
            }
            return increases;
        }

        let importAbilityScore = function (prefix, abilityScore) {
            const racial = findBonusOfType(abilityScore.scoreBonuses, "Racial");
            const theme = findBonusOfType(abilityScore.scoreBonuses, "Theme");
            const increases = calculateAbilityIncreases(racial, theme, abilityScore.increases);
            let attributes = new Map();

            attributes.set(`${prefix}-race`, racial);
            attributes.set(`${prefix}-theme`, theme);
            attributes.set(`${prefix}-point_buy`, abilityScore.pointBuy);
            attributes.set(`${prefix}-abil_incr`, increases);
            attributes.set(`${prefix}-misc`, abilityScore.total - 10 - racial - theme - abilityScore.pointBuy - increases);

            return attributes;
        }

        let importSkill = function (skill) {
            let prefix = skill.skill.replace(/ /g, "-");

            let attributes = new Map();
            attributes.set(`${prefix}-ranks`, skill.ranks);
            attributes.set(`${prefix}-cs`, skill.classSkill);
            attributes.set(`${prefix}-trained`, skill.classSkill ? 3 : 0);
            attributes.set(`${prefix}-misc`, totalBonus(skill.bonuses));
            attributes.set(`${prefix}-notes`, skill.notes);

            if (skill.name) {
                attributes.set(`${prefix}-name`, skill.name);
            }

            return attributes;
        }

        let importSpecialAbility = function (type, name, description) {
            let attributes = new Map();
            let id = `${Math.random()}`;

            attributes.set(`repeating_feat_${id}_feat_type`, type);
            attributes.set(`repeating_feat_${id}_feat_name`, name);
            attributes.set(`repeating_feat_${id}_description`, description);

            return attributes;
        }

        let importDroneSpecialAbility = function (type, name, description) {
            let attributes = new Map();
            let id = `${Math.random()}`;

            attributes.set(`repeating_drone-feat_${id}_drone-feat_type`, type);
            attributes.set(`repeating_drone-feat_${id}_drone-feat_name`, name);
            attributes.set(`repeating_drone-feat_${id}_drone-feat-description`, description);

            return attributes;
        }

        let importClassFeature = function (className, feature) {
            let description = feature.description;
            if (feature.options && feature.options.length > 0) {
                description += `\n\n-----\nSelected Option${feature.options.length === 1 ? "" : "s"}\n-----`;
                for (const opt of feature.options) {
                    description += `\n\n${opt.name}\n${opt.description}`;
                }
            }

            return importSpecialAbility("Class", `${feature.name} (${className})`, description);
        }

        let createDurationMacro = function (literalDuration) {
            let durationMacro = literalDuration;

            let dismissable = false;
            if (durationMacro.endsWith("(D)")) {
                dismissable = true;
            }

            if (durationMacro.startsWith('1 round/level')) {
                durationMacro = "[[@{spellclass-0-level}]] rounds";
            } else if (durationMacro.startsWith('1 minute/level')) {
                durationMacro = "[[@{spellclass-0-level}]] minutes";
            } else if (durationMacro.startsWith('1 day/level')) {
                durationMacro = "[[@{spellclass-0-level}]] days";
            } else if (durationMacro.startsWith('10 minutes/level')) {
                durationMacro = "[[@{spellclass-0-level} * 10]] minutes";
            } else if (durationMacro.startsWith('1 round, 1 round/3 levels')) {
                durationMacro = "[[1 + [[floor(@{spellclass-0-level} / 3 ) ]] ]] rounds";
            } else if (durationMacro.startsWith('concentration, 1 minute/level')) {
                durationMacro = "concentration, up to [[@{spellclass-0-level}]] minutes";
            }            

            if (durationMacro !== literalDuration && dismissable) {
                durationMacro += " (D)";
            }

            return durationMacro;
        }

        let hasRangedAttack = function (spellName) {
            return spellName === 'Caustic Conversion' || spellName === 'Ectoplasmic Barrage' || spellName === 'Crush Skull' || spellName === 'Dimensional Anchor'
            || spellName === 'Disintegrate'  || spellName === 'Dominate Person'  || spellName === 'Energy Ray'  || spellName === 'Enervation'  
            || spellName === 'Feeblemind' || spellName === 'Flesh to Stone' || spellName === 'Radiation Ray' || spellName === 'Ray of Exhaustion' 
            || spellName === 'Soul Surge'  || spellName === 'Telekinesis'  || spellName === 'Telekinetic Projectile' || spellName === 'Tripartite Beam'
            || spellName === 'Conjure Grenade';
        }

        let hasMeleeAttack = function (spellName) {
             return spellName === 'Bestow Curse' || spellName === 'Compress Creature' || spellName === 'Dissonance Strike' || spellName === 'Eclipse Touch'
                || spellName === 'Entropic Grasp' || spellName === 'Fatigue' || spellName === 'Gravity Tether' || spellName === 'Grim Insight' 
                || spellName === 'Inflame' || spellName === 'Inject Nanobots' || spellName === 'Instant Virus' || spellName === 'Jolting Surge' 
                || spellName === 'Overload Systems' || spellName === 'Star Touch' || spellName === 'Star Touch'
                || spellName === 'Subzero Clutch' || spellName === 'Synapse Overload' || spellName === 'Void Grasp';
        }

        let getSpellDamage = function (spellName, spellLevel) {
            let spellDamage = '';

            switch(spellName) {
                case 'Furious Shriek':
                    switch(spellLevel) {
                        case '1':
                            spellDamage = '2d6';
                            break;
                        case '2':
                            spellDamage = '4d6';
                            break;
                        case '3':
                            spellDamage = '7d6';
                            break;
                        case '4':
                            spellDamage = '10d6';
                            break;
                        case '5':
                            spellDamage = '13d6';
                            break;
                        case '6':
                            spellDamage = '16d6';
                            break;
                    }
                    break;
                case 'Energy Ray': // scaling
                    spellDamage = '1d3';
                    break;
                case 'Cosmic Eddy':
                    spellDamage = '4d6';
                    break;
                case 'Elemental Convergence':
                    spellDamage = '8d8';
                    break;
                case 'Chrono Leap':
                    spellDamage = '4d6';
                    break;
                case 'Ectoplasmic Eruption':
                    spellDamage = '6d6';
                    break;
                case 'Flash Boil':
                    spellDamage = '7d8';
                    break;
                case 'Infect Blood':
                    spellDamage = '3d8';
                    break;
                case 'Arcing Surge':
                    spellDamage = '10d6';
                    break;
                case 'Explosive Blast':
                    spellDamage = '9d6';
                    break;
                case 'Caustic Conversion':
                    spellDamage = '4d4';
                    break;
                case 'Pressurize':
                    spellDamage = '2d10';
                    break;
                case 'Sinking Ship':
                    spellDamage = '6d10';
                    break;
                case 'Acid Puddle':
                    spellDamage = '6d6';
                    break;
                case 'Acidic Mist':
                    spellDamage = '2d6';
                    break;
                case 'Artificial Geyser':
                    spellDamage = '3d6';
                    break;
                case 'Cavitation Sphere':
                    spellDamage = '4d10';
                    break;
                case 'Chain Surge':
                    spellDamage = '13d12';
                    break;
                case 'Conjure Grenade': // scaling
                    spellDamage = '1d4';
                    break;
                case 'Crystal Eruption':
                    spellDamage = '2d8';
                    break;
                case 'Emberstep':
                    spellDamage = '5d6';
                    break;
                case 'Embrace Of The Void':
                    switch(spellLevel) {
                        case '1':
                            spellDamage = '2d6';
                            break;
                        case '2':
                            spellDamage = '4d6';
                            break;
                        case '3':
                            spellDamage = '7d6';
                            break;
                        case '4':
                            spellDamage = '10d6';
                            break;
                        case '5':
                            spellDamage = '15d6';
                            break;
                        case '6':
                            spellDamage = '17d6';
                            break;
                    }                    
                    break;
                case 'Fist of Damoritosh':
                    spellDamage = '12d8';
                    break;
                case 'Force Blast':
                    spellDamage = '2d6';
                    break;
                case 'Glimpse The End':
                    spellDamage = '15d10';
                    break;
                case 'Gravitational Singularity':
                    spellDamage = '12d8';
                    break;
                case 'Heat Leech':
                    spellDamage = '13d8';
                    break;
                case 'Ice Prison':
                    spellDamage = '8d6';
                    break;
                case 'Inject Nanobots':
                    spellDamage = '4d8';
                    break;
                case 'Junk Shards':
                    spellDamage = '3d6';
                    break;
                case 'Mind Thrust':
                    switch(spellLevel) {
                        case '1':
                            spellDamage = '2d10';
                            break;
                        case '2':
                            spellDamage = '4d10';
                            break;
                        case '3':
                            spellDamage = '7d10';
                            break;
                        case '4':
                            spellDamage = '10d10';
                            break;
                        case '5':
                            spellDamage = '15d10';
                            break;
                        case '6':
                            spellDamage = '17d10';
                            break;
                    }
                    break;
                case 'Overheat':
                    spellDamage = '2d8';
                    break;
                case 'Slice Reality':
                    spellDamage = '2d6';
                    break;
                case 'Sonic Scream':
                    spellDamage = '6d12';
                    break;
                case 'Soul Reap':
                    spellDamage = '10d8';
                    break;
                case 'Star Storm':
                    spellDamage = '12d8';
                    break;
                case ' Star Touch':
                    spellDamage = '6d10';
                    break;
                case 'Subzero Clutch':
                    spellDamage = '10d8';
                    break;
                case 'Sudden Collision':
                    spellDamage = '7d6';
                    break;
                case "Time's Edge":
                    spellDamage = '10d6';
                    break;
                case 'Trifold Explosion':
                    switch(spellLevel) {
                        case '2':
                            spellDamage = '3d6';
                            break;
                        case '3':
                            spellDamage = '5d6';
                            break;
                        case '4':
                            spellDamage = '7d6';
                            break;
                        case '5':
                            spellDamage = '8d6';
                            break;
                        case '6':
                            spellDamage = '10d6';
                            break;
                    }
                    break;
                case 'Uncanny Eruption':
                    spellDamage = '2d6';
                    break;
                case 'Verdant Blast':
                    spellDamage = '3d6';
                    break;
                case 'Void Grasp':
                    spellDamage = '8d8';
                    break;
                case 'Volcanic Wrath':
                    switch(spellLevel) {
                        case '1':
                            spellDamage = '2d6';
                            break;
                        case '2':
                            spellDamage = '4d6';
                            break;
                        case '3':
                            spellDamage = '7d6';
                            break;
                        case '4':
                            spellDamage = '10d6';
                            break;
                        case '5':
                            spellDamage = '15d6';
                            break;
                        case '6':
                            spellDamage = '17d6';
                            break;
                    }
                    break;
                }

            return spellDamage;
        }

        let createSpellMacro = function (spellName, spellLevel) {

            // TODO wave of warning
            // TODO Channel the Outer Sphere
            // TODO Control Atmosphere
            // TODO Control Winds - downcasting
            // TODO Mystic Cure, Mass Mystic Cure
            // TODO Polar Vortex
            // TODO Rewire Flesh, Ride The Wave, Umbral Tendrils - add macro button to roll damage?
            // TODO Thought Ripple
            // TODO Verdant Code

            // TODO add save effect to macro
            let macroText = "&{template:pf_spell} {{name=@{name}}} {{level=@{spellclass-0-name} "+spellLevel+"}} {{school=@{school}}} {{casting_time=@{cast-time}}} {{range=@{range}}} {{target=@{targets}}} {{duration=@{duration}}} {{saving_throw=@{save}}} {{sr=@{sr}}}";
            
            // TODO force blast - attempt bull rush  using your caster level + your key ability score modifier as your attack bonus
            if (hasMeleeAttack(spellName)) {
                macroText += " {{mel_attack=[[1d20+@{attk-melee}]]}}";
            }
            
            if (hasRangedAttack(spellName)) {
                macroText += " {{rng_attack=[[1d20 + @{attk-ranged}]]}}";
            }

            // TODO disintegrate
            // TODO Tripartite Beam
            // TODO Shadowy Fleet
            // TODO Snuff Life
            // TODO Dimensional Crash
            // TODO scaling cantrips: Energy Ray, Conjure Grenade, Pierce Veil
            // TODO downcasting: Furious Shriek
            // TODO Hailstorm
            // TODO Ice Bolt
            // TODO Puncture Veil
            let spellDamage = getSpellDamage(spellName, spellLevel);
            if (spellDamage !== '') {
                macroText += " {{damage="+spellDamage+" ([["+spellDamage+"]])}}";
            }
            
            macroText += " {{spell_description=@{description}}}";

            return macroText;
        }

        let importSpell = function (klass, spell) {
            let attributes = new Map();
            let id = `${Math.random()}`;

            let level = 0;
            let levelObj = spell.level.find(l => l.class === klass);
            if (levelObj) {
                level = levelObj.level;
            } else {
                const total = spell.level.reduce((p, l) => p + l.level, 0);
                level = Math.round(total / spell.level.length);
            }

            attributes.set(`repeating_lvl-${level}-spells_${id}_name`, spell.name);
            attributes.set(`repeating_lvl-${level}-spells_${id}_school`, spell.school);

            let castingTime = spell.castingTime;
            if (castingTime === "1 standard action") {
                castingTime = "1 standard";
            }
            attributes.set(`repeating_lvl-${level}-spells_${id}_cast-time`, castingTime);

            let range = spell.range;
            if (range.startsWith("close")) {
                range = "close ([[@{spellclass-0-close}]] feet)";
            } else if (range.startsWith("medium")) {
                range = "medium ([[@{spellclass-0-medium}]] ft.)";
            } else if (range.startsWith("long")) {
                range = "long ([[@{spellclass-0-long}]] ft.)";
            }
            attributes.set(`repeating_lvl-${level}-spells_${id}_range`, range);

            attributes.set(`repeating_lvl-${level}-spells_${id}_duration`, createDurationMacro(spell.duration));

            // TODO hurl forcedisk
            if (spell.name === 'Magic Missile') {
                attributes.set(`repeating_lvl-${level}-spells_${id}_description`, "You fire several missiles of magical energy that strike targets unerringly (the creatures must still be valid targets) and deal 1d4+1 force damage each. As a standard action, you fire 2 missiles; as a full action you can fire 3 missiles.\n\nTarget 1: [[1d4+1]]\nTarget 2: [[1d4+1]]\n?{full?|Yes,Target 3: [[1d4+1]]|No,    }");
            } else {
                attributes.set(`repeating_lvl-${level}-spells_${id}_description`, spell.description);
            }

            // TODO Effect/Target up to one creature/level, no two of which can be more than 30 ft. apart
            let areaEffectTarget = [spell.area, spell.effect, spell.target].filter(x => !!x).join(", ");
            attributes.set(`repeating_lvl-${level}-spells_${id}_targets`, areaEffectTarget);

            if (spell.savingThrow) {
                // TODO spells like Teleport and Dimension Door are coming back with ", Will"
                let saves = spell.savingThrow.map(s => s.save).join(", ");
                let effects = spell.savingThrow.map(s => s.effect).filter(x => !!x).join(", ");
                if (saves === 'Will' || saves === 'Fortitude' || saves === 'Reflex') {
                    saves += ' DC [[@{selected|spellclass-0-level-'+level+'-savedc}]]';
                }
                attributes.set(`repeating_lvl-${level}-spells_${id}_save`, saves);
                attributes.set(`repeating_lvl-${level}-spells_${id}_save_effect`, effects);
            }

            if (spell.spellResistance) {
                let sr = spell.spellResistance.reduce((p, s) => p || s.resistance, false);
                attributes.set(`repeating_lvl-${level}-spells_${id}_sr`, sr ? "Yes" : "No");
            }

            attributes.set(`repeating_lvl-${level}-spells_${id}_macro-text`, createSpellMacro(spell.name, level));

            return attributes;
        }

        let importAttacks = function (prefix, inventory) {
            const attackTypeMap = new Map([
                ["Basic Melee", "@{attk-melee}"],
                ["Advanced Melee", "@{attk-melee}"],
                ["Small Arm", "@{attk-ranged}"],
                ["Longarm", "@{attk-ranged}"],
                ["Heavy Weapon", "@{attk-ranged}"],
                ["Sniper", "@{attk-ranged}"],
                ["Grenade", "@{attk-ranged}"],
            ]);

            const damageTypeToString = function (damage) {
                if (!damage) {
                    return "";
                }

                let damageType = damage.damage.join(" & ");
                if (damage.alternateDamage && damage.alternateDamage.length > 0) {
                    damageType += " | " + damage.alternateDamage.join(" & ");
                }

                return damageType;
            }

            let singleAttributes = new Map();

            for (const item of inventory.sort(i => i.name)) {
                if (item.type !== "Weapon" || item.isEquipped !== true) {
                    continue;
                }

                const isOperative = item.special && item.special.find(s => s.name === "Operative");
                let attackType = 0;
                if (isOperative) {
                    attackType = "@{attk-ranged}";
                } else if (attackTypeMap.has(item.weaponType)) {
                    attackType = attackTypeMap.get(item.weaponType);
                }

                let damageAbility = 0;
                if (item.weaponType === "Basic Melee" || item.weaponType === "Advanced Melee") {
                    damageAbility = "@{STR-mod}";
                }

                singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-weapon-name`, item.name);
                singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-weapon-notes`, item.notes);
                singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-attack-type`, attackType);

                if (item.damage) {
                    singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-weapon-type`, damageTypeToString(item.damage));

                    if (item.damage.dice) {
                        singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-damage-dice-num`, item.damage.dice.count);
                        singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-damage-die`, item.damage.dice.sides);
                    }
                }

                singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-damage-ability`, damageAbility);

                let critical = "";
                if (item.critical) {
                    critical = item.critical.name;
                    if (item.critical.additionalInfo) {
                        critical += ` (${item.critical.additionalInfo})`
                    }
                }

                singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-weapon-critical`, critical);
                singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-weapon-range`, item.range ? item.range : 0);

                singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-weapon-ammo`, item.capacity ? item.capacity : 0);
                singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-weapon-usage`, item.usage ? item.usage : 0);

                singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-weapon-proficiency`, item.proficient === undefined || item.proficient === true ? "0" : "-4");

                let specialization = "0";
                if (item.specialization !== undefined && item.specialization === true) {
                    if (isOperative || item.weaponType === "Small Arm") {
                        specialization = "floor(@{level}/2)";
                    } else {
                        specialization = "@{level}";
                    }
                }

                singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-weapon-specialization`, specialization);

                if (item.crystalId) {
                    let crystal = inventory.find(i => i.id === item.crystalId);
                    if (crystal) {
                        const crystalDamage = damageTypeToString(crystal.damage);
                        singleAttributes.set(`repeating_${prefix}-weapon_${item.id}_${prefix}-solarion-crystal`, `${crystal.name} (${crystal.damage.dice.count}d${crystal.damage.dice.sides}${crystalDamage ? ' ' + crystalDamage : ''})`);
                    }
                }
            }



            return singleAttributes;
        }

        let partition = function (arr, fn) {
            return [
                arr.filter(x => fn(x)),
                arr.filter(x => !fn(x)),
            ]
        }

        let importCharacter = function (data) {
            sendMsg(`Starting import for character '${data.name}'`);

            let singleAttributes = new Map();

            singleAttributes.set("gender", data.gender);
            singleAttributes.set("homeworld", data.homeworld);
            singleAttributes.set("deity", data.deity);
            singleAttributes.set("languages", data.languages);
            singleAttributes.set("speed", importSpeed(data.speed));
            singleAttributes.set("init-misc", totalBonus(data.initiative.bonuses));

            // Vitals
            singleAttributes.set("SP", data.vitals.stamina.max - data.vitals.stamina.damage);
            singleAttributes.set("HP", data.vitals.health.max - data.vitals.health.damage);
            singleAttributes.set("resolve", data.vitals.resolve.max - data.vitals.resolve.damage);
            singleAttributes.set("temp-HP", data.vitals.temporary);
            singleAttributes.set("temp-HP|max", data.vitals.temporary);

            // Race
            if (data.race) {
                const race = data.race;
                singleAttributes.set("race", race.name);
                singleAttributes.set("HP-racial", race.hitPoints);
                singleAttributes.set("size", race.size);

                for (const trait of race.selectedTraits) {
                    singleAttributes = new Map([
                        ...singleAttributes,
                        ...importSpecialAbility("Racial", `${trait.name} (${race.name})`, trait.description),
                    ]);
                }
            }

            // Theme
            if (data.theme) {
                singleAttributes.set("theme", data.theme.name);

                for (const benefit of data.theme.benefits) {
                    singleAttributes = new Map([
                        ...singleAttributes,
                        ...importSpecialAbility("Trait", `${benefit.name} (${data.theme.name})`, benefit.description),
                    ]);
                }
            }

            // Classes
            singleAttributes.set("class", data.classes.map(c => `${c.name} ${c.levels}`).join(" / "));

            let spellClassIndex = 0;
            for (let i = 0; i < data.classes.length; i++) {
                const klass = data.classes[i];
                singleAttributes.set(`class-${i}-hp`, klass.baseHitPoints);
                singleAttributes.set(`class-${i}-name`, klass.name);
                singleAttributes.set(`class-${i}-bab`, klass.baseAttackBonus);
                singleAttributes.set(`class-${i}-skill`, klass.baseSkillRanksPerLevel);
                singleAttributes.set(`class-${i}-Fort`, klass.savingThrows.fortitude);
                singleAttributes.set(`class-${i}-Ref`, klass.savingThrows.reflex);
                singleAttributes.set(`class-${i}-Will`, klass.savingThrows.will);
                singleAttributes.set(`class-${i}-level`, klass.levels);

                for (const feature of klass.features) {
                    singleAttributes = new Map([
                        ...singleAttributes,
                        ...importClassFeature(klass.name, feature),
                    ]);
                }

                if (klass.archetype) {
                    for (const feature of klass.archetype.features) {
                        singleAttributes = new Map([
                            ...singleAttributes,
                            ...importClassFeature(klass.archetype.name, feature),
                        ]);
                    }
                }

                if (klass.spellsKnown.some(x => x > 0)) {
                    singleAttributes.set(`spellclass-${spellClassIndex}-name`, klass.name);
                    singleAttributes.set(`spellclass-${spellClassIndex}-level`, klass.levels);
                    singleAttributes.set(`Concentration-${spellClassIndex}-ability`, `(@{${klass.keyAbility.toUpperCase().substring(0, 3)}-mod})`);

                    for (let j = 0; j <= 6; j++) {
                        const perDay = klass.spellsPerDay[j] ? klass.spellsPerDay[j] : 0;
                        const known = klass.spellsKnown[j] ? klass.spellsKnown[j] : 0;
                        const uses = klass.spellsUsed[j] ? perDay - klass.spellsUsed[j] : perDay;

                        singleAttributes.set(`spellclass-${spellClassIndex}-level-${j}-class`, perDay);
                        singleAttributes.set(`spellclass-${spellClassIndex}-level-${j}-spells-known`, known);
                        singleAttributes.set(`spellclass-${spellClassIndex}-level-${j}-spells-per-day`, uses);
                    }

                    spellClassIndex++;
                }

                for (const spell of klass.spells) {
                    singleAttributes = new Map([
                        ...singleAttributes,
                        ...importSpell(klass.name, spell),
                    ]);
                }
            }

            // Feats
            for (const feat of data.feats.acquiredFeats) {
                let name = feat.name;
                if (feat.selectedOptions) {
                    name += ` (${feat.selectedOptions.map(x => x.name).join(", ")})`;
                }

                let description = feat.description;

                let addSection = function (heading, content) {
                    if (content) {
                        description += `\n\n-----\n${heading}\n-----\n${content}`;
                    }
                }

                addSection("Prerequisite", feat.prerequisite);
                addSection("Benefit", feat.benefit);
                addSection("Normal", feat.normal);
                addSection("Special", feat.special);

                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSpecialAbility("Feat", name, description),
                ]);
            }

            // Ability Score
            singleAttributes = new Map([
                ...singleAttributes,
                ...importAbilityScore("STR", data.abilityScores.strength),
                ...importAbilityScore("DEX", data.abilityScores.dexterity),
                ...importAbilityScore("CON", data.abilityScores.constitution),
                ...importAbilityScore("INT", data.abilityScores.intelligence),
                ...importAbilityScore("WIS", data.abilityScores.wisdom),
                ...importAbilityScore("CHA", data.abilityScores.charisma),
            ]);

            // Skills
            for (const skill of data.skills) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSkill(skill),
                ]);
            }

            // Saving Throws
            singleAttributes.set("Fort-misc", totalBonus(data.saves.fortitude.bonuses));
            singleAttributes.set("Ref-misc", totalBonus(data.saves.reflex.bonuses));
            singleAttributes.set("Will-misc", totalBonus(data.saves.will.bonuses));

            // Attack Bonuses
            singleAttributes.set("attk-melee-misc", totalBonus(data.attackBonuses.melee.bonuses));
            singleAttributes.set("attk-ranged-misc", totalBonus(data.attackBonuses.ranged.bonuses));
            singleAttributes.set("attk-thrown-misc", totalBonus(data.attackBonuses.thrown.bonuses));

            // Resistances
            let dr = [];
            for (const [type, obj] of Object.entries(data.resistances.dr)) {
                dr.push(`${obj.value}/${splitCamelCase(type)}`);
            }
            singleAttributes.set("DR", dr.join(", "));

            let er = [];
            for (const [type, obj] of Object.entries(data.resistances.er)) {
                er.push(`${splitCamelCase(type)} ${obj.value}`);
            }
            singleAttributes.set("resistances", er.join(", "));

            const importInstalledUpgrades = function (prefix, ids, max) {
                let installedUpgrades = data.inventory.filter(i => i.type === "ArmorUpgrade" && ids.includes(i.id));
                if (installedUpgrades) {
                    for (let i = 0; i < Math.min(installedUpgrades.length, max); i++) {
                        singleAttributes.set(`${prefix}upgrade${i + 1}-name`, installedUpgrades[i].name);
                        singleAttributes.set(`${prefix}upgrade${i + 1}-slots`, installedUpgrades[i].slots);
                        singleAttributes.set(`${prefix}upgrade${i + 1}-notes`, installedUpgrades[i].notes);
                    }
                }
            }

            // Equipped Armor
            let equippedArmor = data.inventory.find(i => i.type === "Armor" && i.isEquipped);
            if (equippedArmor) {
                singleAttributes.set("armor", equippedArmor.name);
                singleAttributes.set("armor-type", equippedArmor.armorType);
                singleAttributes.set("armor-equipped", equippedArmor.isEquipped);
                singleAttributes.set("armor-eacbonus", equippedArmor.eacBonus);
                singleAttributes.set("armor-kacbonus", equippedArmor.kacBonus);
                singleAttributes.set("armor-max-dex", equippedArmor.maxDexBonus);
                singleAttributes.set("acp", equippedArmor.armorCheckPenalty);
                singleAttributes.set("speed-adj", equippedArmor.speedAdjustment);
                singleAttributes.set("armor-upgrade-slots", equippedArmor.upgradeSlots);

                importInstalledUpgrades("", equippedArmor.upgradeIds, 7);
            }

            // Currency
            singleAttributes.set("credits", data.credits);
            singleAttributes.set("UPBs", data.upbs);

            // Installed Augmentations
            let installedAugmentations = data.inventory.filter(i => i.type === "Augmentation" && i.isEquipped);
            if (installedAugmentations) {
                for (let i = 0; i < Math.min(installedAugmentations.length, 12); i++) {
                    singleAttributes.set(`agument${i + 1}-name`, installedAugmentations[i].name);
                    singleAttributes.set(`agument${i + 1}-level`, installedAugmentations[i].level);
                    singleAttributes.set(`agument${i + 1}-notes`, installedAugmentations[i].notes);
                }
            }

            // Equipped Shield
            let equippedShield = data.inventory.find(i => i.type === "Shield" && i.isEquipped);
            if (equippedShield) {
                singleAttributes.set("shield", equippedShield.name);
                singleAttributes.set("shield-equipped", equippedShield.isEquipped);
                singleAttributes.set("shield-acbonus", equippedShield.wieldAcBonus);
                singleAttributes.set("shield-align-acbonus", equippedShield.alignedAcBonus);
                singleAttributes.set("shield-max-dex", equippedShield.maxDexBonus < 0 ? 0 : equippedShield.maxDexBonus);
                singleAttributes.set("shield-acp", equippedShield.armorCheckPenalty);

                importInstalledUpgrades("shield-", equippedShield.upgradeIds, 2);
            }

            // Worn Magic & Hybrid Items
            let installedItems = data.inventory.filter(i => i.type === "Item" && i.isEquipped && (i.itemType === "Magic" || i.itemType === "Hybrid"));
            if (installedItems) {
                for (let i = 0; i < Math.min(installedItems.length, 2); i++) {
                    singleAttributes.set(`slot-${i + 1}-magic`, installedItems[i].name);
                    singleAttributes.set(`slot-${i + 1}-magic-level`, installedItems[i].level);
                }
            }

            // Attacks
            singleAttributes = new Map([
                ...singleAttributes,
                ...importAttacks("pc", data.inventory),
            ]);

            // Inventory
            let armorAndWeaponBulk = 0;
            let equipmentBulk = 0;
            for (const item of data.inventory.sort(i => i.name)) {
                singleAttributes.set(`repeating_item_${item.id}_item-name`, item.name);
                singleAttributes.set(`repeating_item_${item.id}_item-level`, item.level ? item.level : 0);
                singleAttributes.set(`repeating_item_${item.id}_item-qty`, item.quantity ? item.quantity : 1);
                singleAttributes.set(`repeating_item_${item.id}_item-bulk`, item.bulk ? item.bulk : 0);
                singleAttributes.set(`repeating_item_${item.id}_item-description`, item.description);

                let bulkToAdd = item.stashed
                    ? 0
                    : (item.bulk ? item.bulk : 0);

                if (item.type === "Armor" || item.type === "Weapon") {
                    armorAndWeaponBulk += bulkToAdd;
                } else {
                    equipmentBulk += bulkToAdd;
                }
            }

            singleAttributes.set("carried-armor-and-weapons", armorAndWeaponBulk);
            singleAttributes.set("carried-equipment", equipmentBulk);

            let character = createObj("character", {
                name: data.name
            });

            for (const [k, v] of singleAttributes) {
                if (v === undefined) {
                    sendMsg(`Error: Undefined value for key '${k}'. Skipping...`);
                    continue;
                }

                createObj("attribute", {
                    name: k,
                    current: v,
                    characterid: character.id,
                });
            }

            sendMsg(`Finished importing character '${data.name}'`);

            if (data.drone) {
                importDrone(data.drone);
            }
        };

        let importDrone = function (data) {
            sendMsg(`Starting import for drone '${data.name}'`);

            let singleAttributes = new Map();
            singleAttributes.set("tab", 2);

            singleAttributes.set("drone_name", data.name);
            singleAttributes.set("drone-level", `${data.level}`);
            singleAttributes.set("drone_speed", importSpeed(data.speed));

            if (data.chassis) {
                singleAttributes.set("drone_size", data.chassis.size);

                switch (data.chassis.name) {
                    case "Combat Drone":
                        singleAttributes.set("drone_chasis", "combat");
                        break;
                    case "Hover Drone":
                        singleAttributes.set("drone_chasis", "hover");
                        break;
                    case "Stealth Drone":
                        singleAttributes.set("drone_chasis", "stealth");
                        break;
                }
            }

            // Ability Score
            const importDroneAbilityScore = function (prefix, abilityScore) {
                const base = abilityScore.base;
                const increases = totalBonus(abilityScore.scoreBonuses);

                singleAttributes.set(`drone-${prefix}-base`, base);
                singleAttributes.set(`drone-${prefix}-abil_incr`, increases);
            }

            importDroneAbilityScore("STR", data.abilityScores.strength);
            importDroneAbilityScore("DEX", data.abilityScores.dexterity);
            importDroneAbilityScore("INT", data.abilityScores.intelligence);
            importDroneAbilityScore("WIS", data.abilityScores.wisdom);
            importDroneAbilityScore("CHA", data.abilityScores.charisma);

            // Skills
            for (const skill of data.skills) {
                singleAttributes.set(`drone-${skill.skill}-installed`, '(3 + @{drone-level})');
                singleAttributes.set(`drone-${skill.skill}-misc-mod`, totalBonus(skill.bonuses));
            }

            // Vitals
            singleAttributes.set('HP-drone', data.vitals.health.max - data.vitals.health.damage);
            singleAttributes.set('HP-drone_max', data.vitals.health.max);
            singleAttributes.set('temp-HP-drone', data.vitals.temporary);
            singleAttributes.set('temp-HP-drone_max', data.vitals.temporary);

            // Armor Class
            const importDroneAc = function (bonuses, ac) {
                let [level, mod] = partition(bonuses, b => b.source === "Level");
                let base = totalBonus(level);

                singleAttributes.set(`drone-${ac}-mod`, totalBonus(mod));

                if (data.chassis) {
                    base += data.chassis[ac];
                }

                singleAttributes.set(`drone-base-${ac}`, base);
            };

            importDroneAc(data.armorClass.eac.bonuses, "eac");
            importDroneAc(data.armorClass.eac.bonuses, "kac");

            // Saving Throws
            const importDroneSavingThrow = function (bonuses, baseKey, modKey) {
                let [level, mod] = partition(bonuses, b => b.source === "Level");
                singleAttributes.set(baseKey, totalBonus(level));
                singleAttributes.set(modKey, totalBonus(mod));
            };

            importDroneSavingThrow(data.saves.fortitude.bonuses, "drone-Fort-base", "drone-Fort-mod");
            importDroneSavingThrow(data.saves.reflex.bonuses, "drone-Ref-base", "drone-Ref-mod");
            importDroneSavingThrow(data.saves.will.bonuses, "drone-Will-base", "drone-Will-enhance");

            // Resistances
            let dr = [];
            for (const [type, obj] of Object.entries(data.resistances.dr)) {
                dr.push(`${obj.value}/${splitCamelCase(type)}`);
            }
            singleAttributes.set("drone-DR", dr.join(", "));

            let er = [];
            for (const [type, obj] of Object.entries(data.resistances.er)) {
                er.push(`${splitCamelCase(type)} ${obj.value}`);
            }
            singleAttributes.set("drone-resist", er.join(", "));

            // Armor Upgrades
            const installedUpgrades = data.inventory.filter(i => i.type === "ArmorUpgrade" && i.isInstalled);
            for (let i = 0; i < installedUpgrades.length; i++) {
                singleAttributes.set(`upgrade-name${i === 0 ? '' : i}`, installedUpgrades[i].name);
                singleAttributes.set(`upgrade-notes${i === 0 ? '' : i}`, installedUpgrades[i].notes);
            }

            // Attacks
            singleAttributes.set("drone-bab", data.attackBonuses.bab.total);
            singleAttributes.set("drone-attk-melee-misc", totalBonus(data.attackBonuses.melee.bonuses));
            singleAttributes.set("drone-attk-range-misc", totalBonus(data.attackBonuses.ranged.bonuses));
            singleAttributes.set("drone-attk-thrown-misc", totalBonus(data.attackBonuses.thrown.bonuses));

            // Special Abilities
            for (const sa of data.specialAbilities) {
                let description = sa.description;
                if (sa.options && sa.options.length > 0) {
                    description += `\n\n-----\nSelected Option${sa.options.length === 1 ? "" : "s"}\n-----`;
                    for (const opt of sa.options) {
                        description += `\n\n${opt.name}\n${opt.description}`;
                    }
                }

                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importDroneSpecialAbility("Special Ability", sa.name, description),
                ]);
            }

            // Feats
            for (const feat of data.feats.acquiredFeats) {
                let name = feat.name;
                if (feat.selectedOptions) {
                    name += ` (${feat.selectedOptions.map(x => x.name).join(", ")})`;
                }

                let description = feat.description;

                let addSection = function (heading, content) {
                    if (content) {
                        description += `\n\n-----\n${heading}\n-----\n${content}`;
                    }
                }

                addSection("Prerequisite", feat.prerequisite);
                addSection("Benefit", feat.benefit);
                addSection("Normal", feat.normal);
                addSection("Special", feat.special);

                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importDroneSpecialAbility("Feat", name, description),
                ]);
            }

            // Mods
            for (const mod of data.mods.installedMods) {
                let description = mod.description;
                if (mod.selectedOptions && mod.selectedOptions.length > 0) {
                    description += `\n\n-----\nSelected Option${mod.selectedOptions.length === 1 ? "" : "s"}\n-----`;
                    for (const opt of mod.selectedOptions) {
                        description += `\n\n${opt.name}\n${opt.description}`;
                    }
                }

                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importDroneSpecialAbility("Mod", mod.name, description),
                ]);
            }

            // Attacks
            singleAttributes = new Map([
                ...singleAttributes,
                ...importAttacks("drone", data.inventory)
            ]);

            let drone = createObj("character", {
                name: data.name
            });

            for (const [k, v] of singleAttributes) {
                if (v === undefined) {
                    sendMsg(`Error: Undefined value for key '${k}'. Skipping...`);
                    continue;
                }

                createObj("attribute", {
                    name: k,
                    current: v,
                    characterid: drone.id,
                });
            }

            sendMsg(`Finished importing drone '${data.name}'`);
        }

        let importStarshipCondition = function (condition, glitchingId, malfunctioningId, wreckedId) {
            let attributes = new Map();

            if (condition === "Wrecked") {
                attributes.set(wreckedId, -2);
                attributes.set(malfunctioningId, -2);
                attributes.set(glitchingId, -2);
            } else if (condition === "Malfunctioning") {
                attributes.set(malfunctioningId, -2);
                attributes.set(glitchingId, -2);
            } else if (condition === "Glitching") {
                attributes.set(glitchingId, -2);
            }

            return attributes;
        }

        let importStarship = function (data) {
            sendMsg(`Starting import for starship '${data.name}'`);

            let singleAttributes = new Map();
            singleAttributes.set("tab", 3);

            singleAttributes.set("starship-name", data.name);
            singleAttributes.set("starship-tier", data.tier);
            singleAttributes.set("starship-make", `${data.manufacturer} ${data.model}`);

            if (data.baseFrame) {
                const frames = [
                    "Racer",
                    "Interceptor",
                    "Fighter",
                    "Shuttle",
                    "Light Freighter",
                    "Explorer",
                    "Transport",
                    "Destroyer",
                    "Heavy Freighter",
                    "Bulk Freighter",
                    "Cruiser",
                    "Transport",
                    "Carrier",
                    "Battleship",
                    "Dreadnought",
                ];

                singleAttributes.set("starship-frame", frames.indexOf(data.baseFrame.name) + 1);

                const sizes = {
                    "Tiny": 2,
                    "Small": 1,
                    "Medium": 0,
                    "Large": -1,
                    "Huge": -2,
                    "Gargantuan": -4,
                    "Colossal": -8,
                }

                singleAttributes.set("starship-size", sizes[data.baseFrame.size]);
                singleAttributes.set("starship-damage-threshold", data.damageThreshold);
            }

            let powerCores = [];
            let powerCoresPcu = 0;
            for (const pc of data.powerCores) {
                powerCores.push(pc.name);
                powerCoresPcu += pc.pcu;
            }

            singleAttributes.set("starship-power-core", powerCores.join(", "));
            singleAttributes.set("starship-PCU", powerCoresPcu);

            if (data.interstellarDrive) {
                singleAttributes.set("starship-drift-engine", data.interstellarDrive.name);
                singleAttributes.set("starship-drift-rating", data.interstellarDrive.engineRating);
            }

            if (data.thruster) {
                singleAttributes.set("starship-thrusters", data.thruster.name);
                singleAttributes.set("starship-thruster-speed", data.thruster.pilotingModifier);
            }


            let armorName = [];
            let acBonus = 0;
            let tlPenalty = 0;

            if (data.armor) {
                armorName.push(data.armor.name);
                acBonus += data.armor.acBonus;
                tlPenalty += data.armor.tlPenalty;
            }

            if (data.ablativeArmor) {
                armorName.push(data.ablativeArmor.name);
                tlPenalty += data.ablativeArmor.tlPenalty;
            }

            singleAttributes.set("starship-armor", armorName.join(", "));
            singleAttributes.set("starship-armor-bonus", acBonus);
            singleAttributes.set("starship-armor-tl", tlPenalty);

            if (data.defensiveCountermeasure) {
                singleAttributes.set("starship-CM", data.defensiveCountermeasure.name);
                singleAttributes.set("starship-CM-bonus", data.defensiveCountermeasure.tlBonus);
            }

            if (data.shield) {
                singleAttributes.set("starship-shields", data.shield.name);
                singleAttributes.set("starship-total-shield-points", data.shield.totalSp);

                singleAttributes.set("starship-fwd-shields", data.arcs.forward.normalShields ? data.arcs.forward.normalShields : data.shield.totalSp / 4);
                singleAttributes.set("starship-port-shields", data.arcs.port.normalShields ? data.arcs.port.normalShields : data.shield.totalSp / 4);
                singleAttributes.set("starship-aft-shields", data.arcs.aft.normalShields ? data.arcs.aft.normalShields : data.shield.totalSp / 4);
                singleAttributes.set("starship-stbd-shields", data.arcs.starboard.normalShields ? data.arcs.starboard.normalShields : data.shield.totalSp / 4);
            }

            if (data.computer) {
                singleAttributes.set("starship-computer", data.computer.name);
                singleAttributes.set("starship-computer-bonus", data.computer.bonus[0]);
                singleAttributes.set("starship-computer-nodes", data.computer.bonus.length);
            }

            if (data.sensor) {
                const ranges = {
                    "Short (5 hexes)": 5,
                    "Medium (10 hexes)": 10,
                    "Long (20 hexes)": 20,
                };

                singleAttributes.set("starship-sensor", data.sensor.name);
                singleAttributes.set("starship-sensors-range", ranges[data.sensor.range]);
                singleAttributes.set("starship-sensors-mod", data.sensor.modifier);
            }

            singleAttributes.set("starship-bays", data.expansionBays.map(eb => eb.name).join("\n"));

            singleAttributes.set("starship-crew-size", data.crew.length);
            singleAttributes.set("starship-crew-capt", data.crew.filter(c => c.role === "Captain").map(c => c.name).join(", "));
            singleAttributes.set("starship-crew-eng", data.crew.filter(c => c.role === "Engineer").map(c => c.name).join(", "));
            singleAttributes.set("starship-crew-gun", data.crew.filter(c => c.role === "Gunner").map(c => c.name).join(", "));
            singleAttributes.set("starship-crew-pilot", data.crew.filter(c => c.role === "Pilot").map(c => c.name).join(", "));
            singleAttributes.set("starship-crew-sci", data.crew.filter(c => c.role === "Science Officer").map(c => c.name).join(", "));
            singleAttributes.set("starship-crew-mate", data.crew.filter(c => c.role === "Chief Mate").map(c => c.name).join(", "));
            singleAttributes.set("starship-crew-magic", data.crew.filter(c => c.role === "Magic Officer").map(c => c.name).join(", "));

            const pilotingRanks = Math.max(...data.crew.filter(c => c.role === "Pilot").map(c => c.pilotingRanks));
            singleAttributes.set("starship-ac-pilot", pilotingRanks);
            singleAttributes.set("starship-tl-pilot", pilotingRanks);

            singleAttributes.set("hp_max", data.hullPoints.total);
            singleAttributes.set("hp", data.hullPoints.current);

            let forwardIndex = 1;
            let portIndex = 1;
            let aftIndex = 1;
            let starboardIndex = 1;
            let turretIndex = 1;

            for (const weapon of data.weapons) {
                const importWeapon = function (prefix, wep, index) {
                    let special = "";
                    if (wep.special) {
                        special = wep.special.map(s => `${s.name}${s.additionalInfo ? ` (${s.additionalInfo})` : ""}`).join(", ");
                    }

                    singleAttributes.set(`starship-weapon-${prefix}-weapon${index}-show`, true);
                    singleAttributes.set(`starship-${prefix}-weapon${index}`, wep.name);
                    singleAttributes.set(`starship-${prefix}-weapon${index}-rng`, `${wep.range}${wep.speed ? `, Speed ${wep.speed}` : ''}`);
                    singleAttributes.set(`starship-${prefix}-weapon${index}-dmg`, wep.damage ? `${wep.damage.dice.count}d${wep.damage.dice.sides}` : "");
                    singleAttributes.set(`starship-${prefix}-weapon${index}-special`, special);
                };

                switch (weapon.installedArc) {
                    case "Turret":
                        importWeapon("turret", weapon, turretIndex);
                        turretIndex += 1;
                        break;
                    case "Forward":
                        importWeapon("fwd", weapon, forwardIndex);
                        forwardIndex += 1;
                        break;
                    case "Aft":
                        importWeapon("aft", weapon, aftIndex);
                        aftIndex += 1;
                        break;
                    case "Port":
                        importWeapon("port", weapon, portIndex);
                        portIndex += 1;
                        break;
                    case "Starboard":
                        importWeapon("stbd", weapon, starboardIndex);
                        starboardIndex += 1;
                        break;
                }
            }

            singleAttributes = new Map([
                ...singleAttributes,
                ...importStarshipCondition(data.condition.lifeSupport, "starship-LS-damage-glitch", "starship-LS-damage-malf", "starship-LS-damage-wreck"),
                ...importStarshipCondition(data.condition.sensors, "starship-sensor-damage-glitch", "starship-sensor-damage-malf", "starship-sensor-damage-wreck"),
                ...importStarshipCondition(data.condition.engines, "starship-engine-damage-glitch", "starship-engine-damage-malf", "starship-engine-damage-wreck"),
                ...importStarshipCondition(data.condition.powerCore, "starship-core-damage-glitch", "starship-core-damage-malf", "starship-core-damage-wreck"),
                ...importStarshipCondition(data.arcs.forward.condition, "starship-fwd-weapon-damage-glitch", "starship-fwd-weapon-damage-malf", "starship-fwd-weapon-damage-wreck"),
                ...importStarshipCondition(data.arcs.aft.condition, "starship-aft-weapon-damage-glitch", "starship-aft-weapon-damage-malf", "starship-aft-weapon-damage-wreck"),
                ...importStarshipCondition(data.arcs.port.condition, "starship-port-weapon-damage-glitch", "starship-port-weapon-damage-malf", "starship-port-weapon-damage-wreck"),
                ...importStarshipCondition(data.arcs.starboard.condition, "starship-stbd-weapon-damage-glitch", "starship-stbd-weapon-damage-malf", "starship-stbd-weapon-damage-wreck"),
            ]);

            let starship = createObj("character", {
                name: data.name
            });

            for (const [k, v] of singleAttributes) {
                if (v === undefined) {
                    sendMsg(`Error: Undefined value for key '${k}'. Skipping...`);
                    continue;
                }

                createObj("attribute", {
                    name: k,
                    current: v,
                    characterid: starship.id,
                });
            }

            sendMsg(`Finished importing starship '${data.name}'`);

        }

        return {
            importCharacter,
            importStarship
        };
    }());

    let Official = (function () {
        let importAbilityScore = function (prefix, score) {
            let attributes = new Map();

            attributes.set(`${prefix}`, score.total);
            attributes.set(`${prefix}_base`, score.total);
            attributes.set(`${prefix}_mod`, Math.floor((score.total - 10) / 2));

            return attributes;
        };

        let importAbility = function (name, description, source, options) {
            let attributes = new Map();
            let id = `${Math.random()}`;

            attributes.set(`repeating_ability_${id}_show_options`, false);
            attributes.set(`repeating_ability_${id}_name`, name);
            attributes.set(`repeating_ability_${id}_source`, source);

            if (description)
                attributes.set(`repeating_ability_${id}_description`, description);

            if (options) {
                for (const option of options) {
                    attributes = new Map([
                        ...attributes,
                        ...importAbility(option.name, option.description, `${name} (${source})`, []),
                    ]);
                }
            }

            return attributes;
        };

        let importSpell = function (spell, source) {
            let attributes = new Map();
            let id = `${Math.random()}`;

            let level = spell.level[0].level;

            attributes.set(`repeating_spell_${id}_filter`, level === 0 ? "cantrip" : level);
            attributes.set(`repeating_spell_${id}_show_options`, false);
            attributes.set(`repeating_spell_${id}_name`, spell.name);
            attributes.set(`repeating_spell_${id}_level`, level);
            attributes.set(`repeating_spell_${id}_school`, spell.school);
            attributes.set(`repeating_spell_${id}_range`, spell.range);
            attributes.set(`repeating_spell_${id}_target`, spell.target);
            attributes.set(`repeating_spell_${id}_usage`, spell.castingTime);
            attributes.set(`repeating_spell_${id}_source`, source);

            return attributes;
        };

        let importAttack = function (weapon) {
            let attributes = new Map();
            let id = `${Math.random()}`;

            let category = new Map([
                ["Basic Melee", "basic_melee"],
                ["Advanced Melee", "advanced_melee"],
                ["Small Arm", "small_arm"],
                ["Longarm", "longarm"],
                ["Heavy Weapon", "heavy"],
                ["Sniper", "sniper"],
                ["Grenade", "grenade"],
                ["Special", "special"],
            ]);

            let attack_ability = new Map([
                ["Basic Melee", "@{strength_mod}"],
                ["Advanced Melee", "@{strength_mod}"],
                ["Small Arm", "@{dexterity_mod}"],
                ["Longarm", "@{dexterity_mod}"],
                ["Heavy Weapon", "@{dexterity_mod}"],
                ["Sniper", "@{dexterity_mod}"],
                ["Grenade", "@{strength_mod}"],
                ["Special", "@{strength_mod}"],
            ]);

            let damage_ability = new Map([
                ["Basic Melee", "@{strength_mod}"],
                ["Advanced Melee", "@{strength_mod}"],
                ["Small Arm", "0"],
                ["Longarm", "0"],
                ["Heavy Weapon", "0"],
                ["Sniper", "0"],
                ["Grenade", "0"],
                ["Special", "0"],
            ]);

            let engagement_range = new Map([
                ["Basic Melee", "melee"],
                ["Advanced Melee", "melee"],
                ["Small Arm", "ranged"],
                ["Longarm", "ranged"],
                ["Heavy Weapon", "ranged"],
                ["Sniper", "ranged"],
                ["Grenade", "ranged"],
                ["Special", "ranged"],
            ]);

            attributes.set(`repeating_attack_${id}_show_options`, false);
            attributes.set(`repeating_attack_${id}_name`, weapon.name);
            attributes.set(`repeating_attack_${id}_description`, weapon.description);
            attributes.set(`repeating_attack_${id}_level`, weapon.level);
            attributes.set(`repeating_attack_${id}_category`, category.has(weapon.weaponType) ? category.get(weapon.weaponType) : "");
            attributes.set(`repeating_attack_${id}_engagement_range`, engagement_range.has(weapon.weaponType) ? engagement_range.get(weapon.weaponType) : "melee");
            attributes.set(`repeating_attack_${id}_ability`, attack_ability.has(weapon.weaponType) ? attack_ability.get(weapon.weaponType) : "0");
            attributes.set(`repeating_attack_${id}_range`, weapon.range ? weapon.range : "");

            if (weapon.damage) {
                attributes.set(`repeating_attack_${id}_damage_dice`, `${weapon.damage.dice.count}d${weapon.damage.dice.sides}`);
                attributes.set(`repeating_attack_${id}_damage_ability`, damage_ability.has(weapon.weaponType) ? damage_ability.get(weapon.weaponType) : "0");

                let damageType = [];
                if (weapon.damage.damage && weapon.damage.damage.length > 0) {
                    damageType.push(weapon.damage.damage.join(" & "));
                }
                if (weapon.damage.alternateDamage && weapon.damage.alternateDamage.length > 0) {
                    damageType.push(weapon.damage.alternateDamage.join(" & "));
                }

                attributes.set(`repeating_attack_${id}_type`, damageType.join(" | "));
            }

            if (weapon.critical) {
                let additional = "";
                if (weapon.critical.additionalInfo) {
                    additional = ` ${weapon.critical.additionalInfo}`;
                }
                attributes.set(`repeating_attack_${id}_crit`, `${weapon.critical.name}${additional}`);
            }

            if (weapon.special) {
                let special = [];
                for (const s of weapon.special) {
                    let str = s.name;
                    if (s.additionalInfo) {
                        str += " " + s.additionalInfo;
                    }
                    special.push(str);
                }
                attributes.set(`repeating_attack_${id}_special`, special.join(", "))
            }

            if (weapon.capacity) {
                attributes.set(`repeating_attack_${id}_ammo_type`, weapon.ammunitionType);
                attributes.set(`repeating_attack_${id}_ammo`, weapon.capacity);
                attributes.set(`repeating_attack_${id}_ammo_max`, weapon.capacity);
                attributes.set(`repeating_attack_${id}_usage`, weapon.usage);
            }


            return attributes;
        };

        let importVital = function (prefix, vital) {
            let attributes = new Map();

            attributes.set(`${prefix}`, vital.max - vital.damage);
            attributes.set(`${prefix}_max`, `${vital.max}`);

            return attributes;
        }

        let importCharacter = function (data) {
            sendMsg(`Starting import for character '${data.name}'`);

            let singleAttributes = new Map();

            singleAttributes.set("gender", data.gender);
            singleAttributes.set("homeworld", data.homeworld);
            singleAttributes.set("deity", data.deity);
            singleAttributes.set("language", data.languages);
            singleAttributes.set("speed", importSpeed(data.speed));

            // Race
            if (data.race) {
                const race = data.race;
                singleAttributes.set("race", race.name);
                singleAttributes.set("race_hp", race.hitPoints);

                let sizes = [
                    "Fine",
                    "Diminutive",
                    "Tiny",
                    "Small",
                    "Medium",
                    "Large",
                    "Huge",
                    "Gargantuan",
                    "Colossal",
                ]
                singleAttributes.set("size", sizes.indexOf(race.size) - 4);

                for (const trait of race.selectedTraits) {
                    singleAttributes = new Map([
                        ...singleAttributes,
                        ...importAbility(trait.name, trait.description, race.name, trait.selectedOptions),
                    ]);
                }
            }

            // Theme
            if (data.theme) {
                singleAttributes.set("theme", data.theme.name);
                for (const benefit of data.theme.benefits) {
                    singleAttributes = new Map([
                        ...singleAttributes,
                        ...importAbility(benefit.name, benefit.description, data.theme.name, benefit.selectedOptions),
                    ]);
                }
            }

            // Classes
            for (let i = 0; i < data.classes.length; i++) {
                const klass = data.classes[i];

                singleAttributes.set(`class_${i + 1}_name`, klass.name);
                singleAttributes.set(`class_${i + 1}_level`, klass.levels);
                singleAttributes.set(`class_${i + 1}_sp`, klass.baseStaminaPoints);
                singleAttributes.set(`class_${i + 1}_hp`, klass.baseHitPoints);
                singleAttributes.set(`class_${i + 1}_skills`, klass.baseSkillRanksPerLevel);
                singleAttributes.set(`class_${i + 1}_ability`, `@{${klass.keyAbility.toLowerCase()}_mod}`);
                singleAttributes.set(`class_${i + 1}_bab`, klass.baseAttackBonus === klass.levels ? 1 : 0.75);

                const maxSavingThrow = Math.max(klass.savingThrows.fortitude, klass.savingThrows.reflex, klass.savingThrows.will);
                singleAttributes.set(`class_${i + 1}_fort`, klass.savingThrows.fortitude == maxSavingThrow ? "good" : "poor");
                singleAttributes.set(`class_${i + 1}_ref`, klass.savingThrows.reflex == maxSavingThrow ? "good" : "poor");
                singleAttributes.set(`class_${i + 1}_will`, klass.savingThrows.will == maxSavingThrow ? "good" : "poor");

                if (klass.spellsKnown.reduce((p, c) => p + c) > 0) {
                    singleAttributes.set(`class_${i + 1}_spells`, true);

                    for (let j = 0; j < 7; j++) {
                        let id = `level_${j}_spells`;
                        if (j === 0) {
                            id = "cantrips";
                        }

                        let used = 0;
                        if (klass.spellsUsed.length > j) {
                            used = klass.spellsUsed[j];
                        }

                        singleAttributes.set(`class_${i + 1}_${id}_per_day_max`, klass.spellsPerDay[j]);
                        singleAttributes.set(`class_${i + 1}_${id}_per_day`, klass.spellsPerDay[j] - used);
                    }
                }

                for (const feature of klass.features) {
                    singleAttributes = new Map([
                        ...singleAttributes,
                        ...importAbility(feature.name, feature.description, klass.name, feature.options),
                    ]);
                }

                for (const spell of klass.spells) {
                    singleAttributes = new Map([
                        ...singleAttributes,
                        ...importSpell(spell, klass.name),
                    ]);
                }
            }

            // Ability Score
            singleAttributes = new Map([
                ...singleAttributes,
                ...importAbilityScore("strength", data.abilityScores.strength),
                ...importAbilityScore("dexterity", data.abilityScores.dexterity),
                ...importAbilityScore("constitution", data.abilityScores.constitution),
                ...importAbilityScore("intelligence", data.abilityScores.intelligence),
                ...importAbilityScore("wisdom", data.abilityScores.wisdom),
                ...importAbilityScore("charisma", data.abilityScores.charisma),
            ]);

            // Vitals
            singleAttributes = new Map([
                ...singleAttributes,
                ...importVital("hp", data.vitals.health),
                ...importVital("sp", data.vitals.stamina),
                ...importVital("rp", data.vitals.resolve),
                ...importVital("temp_hp", { max: data.vitals.temporary, damage: 0 }),
            ]);

            singleAttributes.set("initiative", data.initiative.total);

            // Saves
            singleAttributes.set("fort_base", data.saves.fortitude.base);
            singleAttributes.set("fort", data.saves.fortitude.total);
            singleAttributes.set("ref_base", data.saves.reflex.base);
            singleAttributes.set("ref", data.saves.reflex.total);
            singleAttributes.set("will_base", data.saves.will.base);
            singleAttributes.set("will", data.saves.will.total);

            // Armor Class
            singleAttributes.set("eac", data.armorClass.eac.total);
            singleAttributes.set("kac", data.armorClass.kac.total);
            singleAttributes.set("cmd", data.armorClass.acVsCombatManeuver.total);

            // Skills
            for (const skill of data.skills) {
                const prefix = skill.skill.toLowerCase().replace(" ", "_").replace(" ", "_");
                singleAttributes.set(`${prefix}_ranks`, skill.ranks);
                singleAttributes.set(`${prefix}_class_skill`, skill.classSkill ? 3 : 0);
                singleAttributes.set(`${prefix}`, skill.total);
            }

            let character = createObj("character", {
                name: data.name
            });

            // Feats
            for (const feat of data.feats.acquiredFeats) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importAbility(feat.name, feat.description, "Feat", feat.selectedOptions),
                ]);
            }

            // Resistances
            let resistance = [];
            for (const [type, obj] of Object.entries(data.resistances.dr)) {
                resistance.push(`${obj.value}/${splitCamelCase(type)}`);
            }
            for (const [type, obj] of Object.entries(data.resistances.er)) {
                resistance.push(`${splitCamelCase(type)} ${obj.value}`);
            }
            singleAttributes.set("dr", resistance.join(", "));

            // Conditions
            singleAttributes.set("asleep", data.conditions.asleep.active);
            singleAttributes.set("bleeding", data.conditions.bleeding.active);
            singleAttributes.set("blinded", data.conditions.blinded.active);
            singleAttributes.set("broken", data.conditions.broken.active);
            singleAttributes.set("burning", data.conditions.burning.active);
            singleAttributes.set("confused", data.conditions.confused.active);
            singleAttributes.set("cowering", data.conditions.cowering.active);
            singleAttributes.set("dazed", data.conditions.dazed.active);
            singleAttributes.set("dazzled", data.conditions.dazzled.active);
            singleAttributes.set("dead", data.conditions.dead.active);
            singleAttributes.set("deafened", data.conditions.deafened.active);
            singleAttributes.set("dying", data.conditions.dying.active);
            singleAttributes.set("entangled", data.conditions.entangled.active);
            singleAttributes.set("exhausted", data.conditions.exhausted.active);
            singleAttributes.set("fascinated", data.conditions.fascinated.active);
            singleAttributes.set("fatigued", data.conditions.fatigued.active);
            singleAttributes.set("flat_footed", data.conditions.flatFooted.active);
            singleAttributes.set("frightened", data.conditions.frightened.active);
            singleAttributes.set("grappled", data.conditions.grappled.active);
            singleAttributes.set("helpless", data.conditions.helpless.active);
            singleAttributes.set("nauseated", data.conditions.nauseated.active);
            singleAttributes.set("off_kilter", data.conditions.offKilter.active);
            singleAttributes.set("off_target", data.conditions.offTarget.active);
            singleAttributes.set("panicked", data.conditions.panicked.active);
            singleAttributes.set("paralyzed", data.conditions.paralyzed.active);
            singleAttributes.set("pinned", data.conditions.pinned.active);
            singleAttributes.set("prone", data.conditions.prone.active);
            singleAttributes.set("shaken", data.conditions.shaken.active);
            singleAttributes.set("sickened", data.conditions.sickened.active);
            singleAttributes.set("stable", data.conditions.stable.active);
            singleAttributes.set("staggered", data.conditions.staggered.active);
            singleAttributes.set("stunned", data.conditions.stunned.active);
            singleAttributes.set("unconscious", data.conditions.unconscious.active);

            if (data.negativeLevels) {
                singleAttributes.set("negative_levels", data.negativeLevels.permanent + data.negativeLevels.temporary);
            }

            // TODO: Encumbered and Overburdened conditions

            // Inventory
            singleAttributes.set("credits", data.credits);
            singleAttributes.set("upb", data.upbs);

            for (const item of data.inventory) {
                let id = `${Math.random()}`;
                singleAttributes.set(`repeating_item_${id}_show_options`, false);
                singleAttributes.set(`repeating_item_${id}_name`, item.name);
                singleAttributes.set(`repeating_item_${id}_description`, item.description);

                if (item.level) {
                    singleAttributes.set(`repeating_item_${id}_level`, item.level);
                }

                if (item.bulk) {
                    singleAttributes.set(`repeating_item_${id}_bulk`, item.bulk);
                }

                if (item.price) {
                    singleAttributes.set(`repeating_item_${id}_cost`, item.price);
                }

                if (item.capacity) {
                    singleAttributes.set(`repeating_item_${id}_uses_max`, item.capacity);
                }

                if (item.stashed) {
                    singleAttributes.set(`repeating_item_${id}_equipped`, "not carried");
                } else if (item.isEquipped || item.isInstalled) {
                    singleAttributes.set(`repeating_item_${id}_equipped`, "equipped");
                } else {
                    singleAttributes.set(`repeating_item_${id}_equipped`, "carried");
                }

                if (item.type === "Weapon") {
                    singleAttributes.set(`repeating_item_${id}_purpose`, "weapon");

                    if (item.isEquipped) {
                        singleAttributes = new Map([
                            ...singleAttributes,
                            ...importAttack(item),
                        ]);
                    }
                } else if (item.type === "Armor") {
                    singleAttributes.set(`repeating_item_${id}_purpose`, "armor");

                    if (item.armorType === "Light") {
                        singleAttributes.set(`repeating_item_${id}_type`, "light_armor");
                    } else if (item.armorType === "Heavy") {
                        singleAttributes.set(`repeating_item_${id}_type`, "heavy_armor");
                    } else if (item.armorType === "Powered") {
                        singleAttributes.set(`repeating_item_${id}_type`, "power_armor");
                    }

                    singleAttributes.set(`repeating_item_${id}_mods`, `${item.eacBonus} armor to eac\n${item.kacBonus} armor to kac\n${item.armorCheckPenalty} armor to acp`);
                } else {
                    singleAttributes.set(`repeating_item_${id}_purpose`, "equipment");
                }
            }

            for (const [k, v] of singleAttributes) {
                if (v === undefined) {
                    sendMsg(`Error: Undefined value for key '${k}'. Skipping...`);
                    continue;
                }

                createObj("attribute", {
                    name: k,
                    current: v,
                    characterid: character.id,
                });
            }

            sendMsg(`Finished importing character '${data.name}'`);

            if (data.drone) {
                importDrone(data.drone);
            }
        };

        let importDrone = function (data) {
            sendMsg(`Starting import for drone '${data.name}'`);

            let singleAttributes = new Map();

            singleAttributes.set(`drone`, true);
            singleAttributes.set("speed", importSpeed(data.speed));
            singleAttributes.set(`class_1_level`, data.level);

            if (data.chassis) {
                singleAttributes.set(`class_1_name`, data.chassis.name);
                singleAttributes.set(`class_1_fort`, data.chassis.goodSaves.includes("Fortitude") ? "good" : "poor");
                singleAttributes.set(`class_1_ref`, data.chassis.goodSaves.includes("Reflex") ? "good" : "poor");
                singleAttributes.set(`class_1_will`, data.chassis.goodSaves.includes("Will") ? "good" : "poor");

                let sizes = [
                    "Fine",
                    "Diminutive",
                    "Tiny",
                    "Small",
                    "Medium",
                    "Large",
                    "Huge",
                    "Gargantuan",
                    "Colossal",
                ]
                singleAttributes.set("size", sizes.indexOf(data.chassis.size) - 4);
            }

            // Ability Score
            singleAttributes = new Map([
                ...singleAttributes,
                ...importAbilityScore("strength", data.abilityScores.strength),
                ...importAbilityScore("dexterity", data.abilityScores.dexterity),
                ...importAbilityScore("constitution", data.abilityScores.constitution),
                ...importAbilityScore("intelligence", data.abilityScores.intelligence),
                ...importAbilityScore("wisdom", data.abilityScores.wisdom),
                ...importAbilityScore("charisma", data.abilityScores.charisma),
            ]);

            // Skills
            for (const skill of data.skills) {
                const prefix = skill.skill.toLowerCase().replace(" ", "_").replace(" ", "_");
                singleAttributes.set(`${prefix}_ranks`, skill.ranks);
                singleAttributes.set(`${prefix}_class_skill`, skill.classSkill ? 3 : 0);
            }

            // Special Abilities
            for (const sa of data.specialAbilities) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importAbility(sa.name, sa.description, "Special Ability", sa.options),
                ]);
            }

            // Mods
            for (const mod of data.mods.installedMods) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importAbility(mod.name, mod.description, "Mod", mod.selectedOptions),
                ]);
            }

            // Feats
            for (const feat of data.feats.acquiredFeats) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importAbility(feat.name, feat.description, "Feat", feat.selectedOptions),
                ]);
            }

            // Resistances
            let resistance = [];
            for (const [type, obj] of Object.entries(data.resistances.dr)) {
                resistance.push(`${obj.value}/${splitCamelCase(type)}`);
            }
            for (const [type, obj] of Object.entries(data.resistances.er)) {
                resistance.push(`${splitCamelCase(type)} ${obj.value}`);
            }
            singleAttributes.set("dr", resistance.join(", "));

            // Conditions
            singleAttributes.set("asleep", data.conditions.asleep.active);
            singleAttributes.set("bleeding", data.conditions.bleeding.active);
            singleAttributes.set("blinded", data.conditions.blinded.active);
            singleAttributes.set("broken", data.conditions.broken.active);
            singleAttributes.set("burning", data.conditions.burning.active);
            singleAttributes.set("confused", data.conditions.confused.active);
            singleAttributes.set("cowering", data.conditions.cowering.active);
            singleAttributes.set("dazed", data.conditions.dazed.active);
            singleAttributes.set("dazzled", data.conditions.dazzled.active);
            singleAttributes.set("dead", data.conditions.dead.active);
            singleAttributes.set("deafened", data.conditions.deafened.active);
            singleAttributes.set("dying", data.conditions.dying.active);
            singleAttributes.set("entangled", data.conditions.entangled.active);
            singleAttributes.set("exhausted", data.conditions.exhausted.active);
            singleAttributes.set("fascinated", data.conditions.fascinated.active);
            singleAttributes.set("fatigued", data.conditions.fatigued.active);
            singleAttributes.set("flat_footed", data.conditions.flatFooted.active);
            singleAttributes.set("frightened", data.conditions.frightened.active);
            singleAttributes.set("grappled", data.conditions.grappled.active);
            singleAttributes.set("helpless", data.conditions.helpless.active);
            singleAttributes.set("nauseated", data.conditions.nauseated.active);
            singleAttributes.set("off_kilter", data.conditions.offKilter.active);
            singleAttributes.set("off_target", data.conditions.offTarget.active);
            singleAttributes.set("panicked", data.conditions.panicked.active);
            singleAttributes.set("paralyzed", data.conditions.paralyzed.active);
            singleAttributes.set("pinned", data.conditions.pinned.active);
            singleAttributes.set("prone", data.conditions.prone.active);
            singleAttributes.set("shaken", data.conditions.shaken.active);
            singleAttributes.set("sickened", data.conditions.sickened.active);
            singleAttributes.set("stable", data.conditions.stable.active);
            singleAttributes.set("staggered", data.conditions.staggered.active);
            singleAttributes.set("stunned", data.conditions.stunned.active);
            singleAttributes.set("unconscious", data.conditions.unconscious.active);

            if (data.negativeLevels) {
                singleAttributes.set("negative_levels", data.negativeLevels.permanent + data.negativeLevels.temporary);
            }

            // TODO: Encumbered and Overburdened conditions

            // Inventory
            for (const item of data.inventory) {
                let id = `${Math.random()}`;
                singleAttributes.set(`repeating_item_${id}_show_options`, false);
                singleAttributes.set(`repeating_item_${id}_name`, item.name);
                singleAttributes.set(`repeating_item_${id}_description`, item.description);

                if (item.level) {
                    singleAttributes.set(`repeating_item_${id}_level`, item.level);
                }

                if (item.bulk) {
                    singleAttributes.set(`repeating_item_${id}_bulk`, item.bulk);
                }

                if (item.price) {
                    singleAttributes.set(`repeating_item_${id}_cost`, item.price);
                }

                if (item.capacity) {
                    singleAttributes.set(`repeating_item_${id}_uses_max`, item.capacity);
                }

                if (item.stashed) {
                    singleAttributes.set(`repeating_item_${id}_equipped`, "not carried");
                } else if (item.isEquipped || item.isInstalled) {
                    singleAttributes.set(`repeating_item_${id}_equipped`, "equipped");
                } else {
                    singleAttributes.set(`repeating_item_${id}_equipped`, "carried");
                }

                if (item.type === "Weapon") {
                    singleAttributes.set(`repeating_item_${id}_purpose`, "weapon");

                    if (item.isEquipped) {
                        singleAttributes = new Map([
                            ...singleAttributes,
                            ...importAttack(item),
                        ]);
                    }
                } else if (item.type === "Armor") {
                    singleAttributes.set(`repeating_item_${id}_purpose`, "armor");

                    if (item.armorType === "Light") {
                        singleAttributes.set(`repeating_item_${id}_type`, "light_armor");
                    } else if (item.armorType === "Heavy") {
                        singleAttributes.set(`repeating_item_${id}_type`, "heavy_armor");
                    } else if (item.armorType === "Powered") {
                        singleAttributes.set(`repeating_item_${id}_type`, "power_armor");
                    }

                    singleAttributes.set(`repeating_item_${id}_mods`, `${item.eacBonus} armor to eac\n${item.kacBonus} armor to kac\n${item.armorCheckPenalty} armor to acp`);
                } else {
                    singleAttributes.set(`repeating_item_${id}_purpose`, "equipment");
                }
            }

            let drone = createObj("character", {
                name: data.name
            });

            for (const [k, v] of singleAttributes) {
                if (v === undefined) {
                    sendMsg(`Error: Undefined value for key '${k}'. Skipping...`);
                    continue;
                }

                createObj("attribute", {
                    name: k,
                    current: v,
                    characterid: drone.id,
                });
            }

            sendMsg(`Finished importing drone '${data.name}'`);
        };

        let importSystem = function (name, description, purpose, pcu, bp, shields, computerBonus, sensorBonus, armor, tl) {
            let attributes = new Map();
            let id = generateRowID();

            attributes.set(`repeating_system_${id}_show_options`, false);
            attributes.set(`repeating_system_${id}_name`, name);
            attributes.set(`repeating_system_${id}_description`, description);

            if (pcu)
                attributes.set(`repeating_system_${id}_pcu`, pcu);

            if (bp)
                attributes.set(`repeating_system_${id}_bp`, bp);

            if (shields)
                attributes.set(`repeating_system_${id}_shields`, shields);

            if (computerBonus)
                attributes.set(`repeating_system_${id}_comp_bonus`, computerBonus);

            if (sensorBonus)
                attributes.set(`repeating_system_${id}_sensor_bonus`, sensorBonus);

            if (armor)
                attributes.set(`repeating_system_${id}_armor`, armor);

            if (tl)
                attributes.set(`repeating_system_${id}_countermeasure`, tl);

            attributes.set(`repeating_system_${id}_purpose`, purpose);
            attributes.set(`repeating_system_${id}_powered`, "ON");

            return attributes;
        }

        let importStarship = function (data) {
            sendMsg(`Starting import for starship '${data.name}'`);

            let singleAttributes = new Map();
            singleAttributes.set("sheet_type", "ship");
            singleAttributes.set("ship_tier", data.tier);
            singleAttributes.set("make_model", `${data.manufacturer} ${data.model}`);
            singleAttributes.set("ship_tier", data.tier);
            singleAttributes.set("hp", data.hullPoints.current);
            singleAttributes.set("hp_max", data.hullPoints.total);

            if (data.turn) {
                singleAttributes.set("maneuverability_info", `turn ${data.turn}`);
            }

            if (data.dt) {
                singleAttributes.set("damage_threshold", data.dt);
            }

            if (data.ct) {
                singleAttributes.set("critical_threshold", data.ct);
            }

            if (data.baseFrame) {
                singleAttributes.set("frame", data.baseFrame.name);
                singleAttributes.set("size", data.baseFrame.size.toLowerCase());
                singleAttributes.set("maneuverability", data.baseFrame.maneuverability.toLowerCase());
            }

            if (data.thruster) {
                singleAttributes.set("speed", data.thruster.speed);
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(data.thruster.name, "", "thrusters", data.thruster.pcu, data.thruster.cost),
                ]);
            }

            if (data.interstellarDrive) {
                singleAttributes.set("drift_rating", data.interstellarDrive.engineRating);
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(data.interstellarDrive.name, "", "drift-engines", null, data.interstellarDrive.cost),
                ]);
            }

            if (data.shield && data.shield.type === "normal") {
                const totalSp = data.shield.totalSp;
                const quarterSp = totalSp / 4;
                singleAttributes.set("shield_total_max", totalSp);
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(data.shield.name, "", "shields", data.shield.pcu, data.shield.cost, totalSp),
                ]);

                let forward = data.arcs.forward.normalShields ? data.arcs.forward.normalShields : quarterSp;
                singleAttributes.set("forward_shields", forward);

                let aft = data.arcs.aft.normalShields ? data.arcs.aft.normalShields : quarterSp;
                singleAttributes.set("aft_shields", aft);

                let port = data.arcs.port.normalShields ? data.arcs.port.normalShields : quarterSp;
                singleAttributes.set("port_shields", port);

                let starboard = data.arcs.starboard.normalShields ? data.arcs.starboard.normalShields : quarterSp;
                singleAttributes.set("starboard_shields", starboard);

                singleAttributes.set("shield_total", forward + aft + port + starboard);
            }

            if (data.armor) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(data.armor.name, "", "armor", null, data.armor.cost, null, null, null, data.armor.acBonus, data.armor.tlPenalty),
                ]);
            }

            if (data.ablativeArmor) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(data.ablativeArmor.name, "", "armor", null, data.ablativeArmor.cost, null, null, null, null, data.ablativeArmor.tlPenalty),
                ]);
            }

            for (const eb of data.expansionBays) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(eb.name, eb.description, "expansion-bay", eb.pcu, eb.cost),
                ]);
            }

            if (data.computer) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(data.computer.name, "", "computer", data.computer.pcu, data.computer.cost, null, data.computer.bonus.map(x => `+${x}`).join("/")),
                ]);
            }

            if (data.defensiveCountermeasure) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(data.defensiveCountermeasure.name, "", "countermeasures", data.defensiveCountermeasure.pcu, data.defensiveCountermeasure.cost, null, null, null, null, data.defensiveCountermeasure.tlBonus),
                ]);
            }

            if (data.sensor) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(data.sensor.name, "", "sensors", null, data.sensor.cost, null, null, data.sensor.modifier, null, null),
                ]);
            }

            for (const pc of data.powerCores) {
                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(pc.name, "", "power-core", pc.pcu, pc.cost, null, null, null, null, null),
                ]);
            }

            for (const sc of data.security) {
                let options = sc.selectedOptions ? sc.selectedOptions.map(x => x.name).join(", ") : undefined;
                const name = sc.name + (options ? ` (${options})` : "");

                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(name, sc.description, "security", sc.pcu, sc.cost),
                ]);
            }

            for (const os of data.otherSystems) {
                let options = os.selectedOptions ? os.selectedOptions.map(x => x.name).join(", ") : undefined;
                const name = os.name + (options ? ` (${options})` : "");

                singleAttributes = new Map([
                    ...singleAttributes,
                    ...importSystem(name, os.description, "", os.pcu, os.cost),
                ]);
            }

            for (const w of data.weapons) {
                let id = `${Math.random()}`;
                singleAttributes.set(`repeating_attack_${id}_show_options`, false);
                singleAttributes.set(`repeating_attack_${id}_name`, w.name);
                singleAttributes.set(`repeating_attack_${id}_type`, w.type.replace(" ", "-").toLowerCase());
                singleAttributes.set(`repeating_attack_${id}_class`, w.class);
                singleAttributes.set(`repeating_attack_${id}_arc`, w.installedArc ? w.installedArc.toLowerCase() : 'turret');
                singleAttributes.set(`repeating_attack_${id}_powered`, w.installedArc ? 'on' : 'off');
                singleAttributes.set(`repeating_attack_${id}_pcu`, w.pcu);
                singleAttributes.set(`repeating_attack_${id}_bp`, w.cost);

                if (w.range) {
                    if (w.range.includes("Short")) {
                        singleAttributes.set(`repeating_attack_${id}_range`, 5);
                    } else if (w.range.includes("Medium")) {
                        singleAttributes.set(`repeating_attack_${id}_range`, 10);
                    } else if (w.range.includes("Long")) {
                        singleAttributes.set(`repeating_attack_${id}_range`, 20);
                    }
                }

                let damage = `${w.damage.dice.count}d${w.damage.dice.sides}`;
                if (w.damageMultiplier) {
                    damage += ` x ${w.damage}`;
                }

                singleAttributes.set(`repeating_attack_${id}_damage_dice`, damage);

                if (w.special) {
                    const special = w.special.map(x => `${x.name}${x.additionalInfo ? ` ${x.additionalInfo}`: ''}`).join("; ");
                    singleAttributes.set(`repeating_attack_${id}_special`, special);
                }

            }

            let condition = new Map([
                ["Normal", "+0"],
                ["Glitching", "-2"],
                ["Malfunctioning", "-4"],
                ["Wrecked", "+1d0cf<0cs>1[wrecked]"],
            ])

            singleAttributes.set("life_support_status", condition.get(data.condition.lifeSupport));
            singleAttributes.set("sensors_status", condition.get(data.condition.sensors));
            singleAttributes.set("engines_status", condition.get(data.condition.engines));
            singleAttributes.set("power_core_status", condition.get(data.condition.powerCore));

            singleAttributes.set("forward_weapons_status", condition.get(data.arcs.forward.condition));
            singleAttributes.set("starboard_weapons_status", condition.get(data.arcs.starboard.condition));
            singleAttributes.set("port_weapons_status", condition.get(data.arcs.port.condition));
            singleAttributes.set("aft_weapons_status", condition.get(data.arcs.aft.condition));

            let captain = [];
            let engineer = [];
            let pilot = [];
            let pilotingRanks = 0;
            let scienceOfficer = [];
            let gunner = [];

            for (const c of data.crew) {
                switch (c.role) {
                    case "Captain":
                        captain.push(c.name);
                        break;
                    case "Engineer":
                        engineer.push(c.name);
                        break;
                    case "Gunner":
                        gunner.push(c.name);
                        break;
                    case "Pilot":
                        pilot.push(c.name);
                        if (c.pilotingRanks > pilotingRanks) {
                            pilotingRanks = c.pilotingRanks;
                        }
                        break;
                    case "Science Officer":
                        scienceOfficer.push(c.name);
                        break;
                }
            }

            singleAttributes.set("captain", captain.join(", "));
            singleAttributes.set("engineer", engineer.join(", "));
            singleAttributes.set("pilot", pilot.join(", "));
            singleAttributes.set("ship_piloting_ranks", pilotingRanks);
            singleAttributes.set("science_officer", scienceOfficer.join(", "));
            singleAttributes.set("gunner", gunner.join(", "));

            let starship = createObj("character", {
                name: data.name
            });

            for (const [k, v] of singleAttributes) {
                if (v === undefined) {
                    sendMsg(`Error: Undefined value for key '${k}'. Skipping...`);
                    continue;
                }

                createObj("attribute", {
                    name: k,
                    current: v,
                    characterid: starship.id,
                });
            }

            sendMsg(`Finished importing starship '${data.name}'`);
        };

        return {
            importCharacter,
            importStarship
        };
    }());

    on("chat:message", function (chatMessage) {
        if (chatMessage.type !== "api" || !playerIsGM(chatMessage.playerid)) {
            return;
        }

        let args = chatMessage.content.split(/ --(help|import-character-simple|import-starship-simple|import-character-roll20|import-starship-roll20) ?/g);

        if (args[0] !== '!hephaistos') {
            return;
        }

        if (args.length === 1 || args[1] === 'help') {
            showHelp();
            return;
        }

        if (args[1] === 'import-character-simple') {
            if (args.length !== 3 || args[2] === '') {
                showHelp();
                return;
            }

            const data = args[2];
            Simple.importCharacter(JSON.parse(data));
        }

        if (args[1] === 'import-starship-simple') {
            if (args.length !== 3 || args[2] === '') {
                showHelp();
                return;
            }

            const data = args[2];
            Simple.importStarship(JSON.parse(data));
        }

        if (args[1] === 'import-character-roll20') {
            if (args.length !== 3 || args[2] === '') {
                showHelp();
                return;
            }

            const data = args[2];
            Official.importCharacter(JSON.parse(data));
        }

        if (args[1] === 'import-starship-roll20') {
            if (args.length !== 3 || args[2] === '') {
                showHelp();
                return;
            }

            const data = args[2];
            Official.importStarship(JSON.parse(data));
        }
    });
}());

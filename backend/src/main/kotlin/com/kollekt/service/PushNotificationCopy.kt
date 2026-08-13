package com.kollekt.service

/**
 * Push notification title/body text, ported from the frontend's per-type strings in
 * `src/i18n/locales/{en,no,sv,da}.json` (`notifications.messages.*` for the body,
 * `social.games.types.*` for a short title) so push copy matches the in-app notification
 * list wording instead of inventing separate strings. Manual mirror, same convention as
 * `src/lib/types.ts` mirroring backend DTOs — keep in sync with [ALL_NOTIFICATION_TYPES] and
 * the locale files when a notification type is added.
 */
object PushNotificationCopy {
    private val TITLES: Map<String, Map<String, String>> =
        mapOf(
            "en" to
                mapOf(
                    "TASK_ASSIGNED" to "Task assigned to me",
                    "TASK_DEADLINE_SOON" to "Task due tomorrow",
                    "TASK_OVERDUE" to "Task deadline expired",
                    "TASK_NUDGE" to "Nudges on my tasks",
                    "TASK_FEEDBACK" to "Feedback on my tasks",
                    "TASK_COMPLETED_LATE" to "Late completion notices",
                    "TASK_OVERDUE_GROUP" to "A housemate's task is overdue",
                    "TASK_PENALTY_APPLIED" to "Penalty applied to my task",
                    "KUDOS_RECEIVED" to "Kudos I receive",
                    "WEEKLY_RECAP" to "Weekly house recap",
                    "TASK_SWAP_REQUESTED" to "Task swap requests",
                    "TASK_SWAP_ACCEPTED" to "Accepted task swaps",
                    "TASK_SWAP_DECLINED" to "Declined task swaps",
                    "NEW_MESSAGE" to "New chat message",
                    "EXPENSE_OWED" to "Expense: you owe money",
                    "EXPENSE_DEADLINE_SOON" to "Expense: payment due tomorrow",
                    "EXPENSE_OVERDUE" to "Expense: payment deadline expired",
                    "SHOPPING_ITEM_ADDED" to "Item added to shopping list",
                    "EVENT_ADDED" to "New calendar event",
                    "HOUSE_RULES_UPDATED" to "House rule updates",
                    "GUEST_NOTICE_CREATED" to "Guest notices",
                    "GUEST_QUIET_HOURS_OVERLAP" to "Quiet-hour guest reminders",
                    "QUIET_HOURS_VIOLATION" to "Quiet-hours violation reports",
                    "HOUSE_RULE_VIOLATION" to "House-rule violation reports",
                    // Deliberately absent from ALL_NOTIFICATION_TYPES — see APP_UPDATE_AVAILABLE
                    // in BODIES below.
                    "APP_UPDATE_AVAILABLE" to "New Kollekt version",
                ),
            "no" to
                mapOf(
                    "TASK_ASSIGNED" to "Oppgave tildelt meg",
                    "TASK_DEADLINE_SOON" to "Oppgave forfaller i morgen",
                    "TASK_OVERDUE" to "Oppgavefristen er utløpt",
                    "TASK_NUDGE" to "Dytt på mine oppgaver",
                    "TASK_FEEDBACK" to "Tilbakemelding på oppgavene mine",
                    "TASK_COMPLETED_LATE" to "Varsel om for sen fullføring",
                    "TASK_OVERDUE_GROUP" to "En romkamerats oppgave er forfalt",
                    "TASK_PENALTY_APPLIED" to "Straff lagt på oppgaven min",
                    "KUDOS_RECEIVED" to "Skryt jeg får",
                    "WEEKLY_RECAP" to "Ukentlig oppsummering",
                    "TASK_SWAP_REQUESTED" to "Forespørsler om oppgavebytte",
                    "TASK_SWAP_ACCEPTED" to "Godtatte oppgavebytter",
                    "TASK_SWAP_DECLINED" to "Avslåtte oppgavebytter",
                    "NEW_MESSAGE" to "Ny chatmelding",
                    "EXPENSE_OWED" to "Utgift: du skylder penger",
                    "EXPENSE_DEADLINE_SOON" to "Utgift: betaling forfaller i morgen",
                    "EXPENSE_OVERDUE" to "Utgift: betalingsfristen er utløpt",
                    "SHOPPING_ITEM_ADDED" to "Vare lagt til i handlelisten",
                    "EVENT_ADDED" to "Ny kalenderhendelse",
                    "HOUSE_RULES_UPDATED" to "Oppdateringer av husregler",
                    "GUEST_NOTICE_CREATED" to "Gjestevarsler",
                    "GUEST_QUIET_HOURS_OVERLAP" to "Påminnelser om stilletid",
                    "QUIET_HOURS_VIOLATION" to "Meldinger om brudd på stilletid",
                    "HOUSE_RULE_VIOLATION" to "Meldinger om brudd på husregler",
                    "APP_UPDATE_AVAILABLE" to "Ny versjon av Kollekt",
                ),
            "sv" to
                mapOf(
                    "TASK_ASSIGNED" to "Uppgift tilldelad mig",
                    "TASK_DEADLINE_SOON" to "Uppgift förfaller imorgon",
                    "TASK_OVERDUE" to "Uppgiftsfristen har gått ut",
                    "TASK_NUDGE" to "Knuffar på mina uppgifter",
                    "TASK_FEEDBACK" to "Feedback på mina sysslor",
                    "TASK_COMPLETED_LATE" to "Avisering om sent slutförd syssla",
                    "TASK_OVERDUE_GROUP" to "En rumskamrats syssla är försenad",
                    "TASK_PENALTY_APPLIED" to "Straff på min syssla",
                    "KUDOS_RECEIVED" to "Beröm jag får",
                    "WEEKLY_RECAP" to "Veckans sammanfattning",
                    "TASK_SWAP_REQUESTED" to "Förfrågningar om uppgiftsbyte",
                    "TASK_SWAP_ACCEPTED" to "Accepterade uppgiftsbyten",
                    "TASK_SWAP_DECLINED" to "Avböjda uppgiftsbyten",
                    "NEW_MESSAGE" to "Nytt chattmeddelande",
                    "EXPENSE_OWED" to "Utgift: du är skyldig pengar",
                    "EXPENSE_DEADLINE_SOON" to "Utgift: betalning förfaller imorgon",
                    "EXPENSE_OVERDUE" to "Utgift: betalningsfristen har gått ut",
                    "SHOPPING_ITEM_ADDED" to "Vara tillagd i inköpslistan",
                    "EVENT_ADDED" to "Ny kalenderhändelse",
                    "HOUSE_RULES_UPDATED" to "Uppdateringar av husregler",
                    "GUEST_NOTICE_CREATED" to "Gästmeddelanden",
                    "GUEST_QUIET_HOURS_OVERLAP" to "Påminnelser om tyst tid",
                    "QUIET_HOURS_VIOLATION" to "Anmälningar om tyst tid",
                    "HOUSE_RULE_VIOLATION" to "Anmälningar om husregler",
                    "APP_UPDATE_AVAILABLE" to "Ny version av Kollekt",
                ),
            "da" to
                mapOf(
                    "TASK_ASSIGNED" to "Opgave tildelt mig",
                    "TASK_DEADLINE_SOON" to "Opgave forfalder i morgen",
                    "TASK_OVERDUE" to "Opgavefristen er udløbet",
                    "TASK_NUDGE" to "Skub på mine opgaver",
                    "TASK_FEEDBACK" to "Feedback på mine opgaver",
                    "TASK_COMPLETED_LATE" to "Besked om for sen fuldførelse",
                    "TASK_OVERDUE_GROUP" to "En bofælles opgave er forfalden",
                    "TASK_PENALTY_APPLIED" to "Straf på min opgave",
                    "KUDOS_RECEIVED" to "Ros jeg får",
                    "WEEKLY_RECAP" to "Ugentlig opsummering",
                    "TASK_SWAP_REQUESTED" to "Anmodninger om opgavebytte",
                    "TASK_SWAP_ACCEPTED" to "Accepterede opgavebytter",
                    "TASK_SWAP_DECLINED" to "Afviste opgavebytter",
                    "NEW_MESSAGE" to "Ny chatbesked",
                    "EXPENSE_OWED" to "Udgift: du skylder penge",
                    "EXPENSE_DEADLINE_SOON" to "Udgift: betaling forfalder i morgen",
                    "EXPENSE_OVERDUE" to "Udgift: betalingsfristen er udløbet",
                    "SHOPPING_ITEM_ADDED" to "Vare tilføjet til indkøbslisten",
                    "EVENT_ADDED" to "Ny kalenderbegivenhed",
                    "HOUSE_RULES_UPDATED" to "Opdateringer af husregler",
                    "GUEST_NOTICE_CREATED" to "Gæstebeskeder",
                    "GUEST_QUIET_HOURS_OVERLAP" to "Påmindelser om stilleperioden",
                    "QUIET_HOURS_VIOLATION" to "Anmeldelser om stilletid",
                    "HOUSE_RULE_VIOLATION" to "Anmeldelser om husregler",
                    "APP_UPDATE_AVAILABLE" to "Ny version af Kollekt",
                ),
        )

    private val BODIES: Map<String, Map<String, String>> =
        mapOf(
            "en" to
                mapOf(
                    "EXPENSE_OWED" to "{{paidBy}} paid for '{{description}}' — you owe {{amount}} kr",
                    "EXPENSE_DEADLINE_SOON" to "'{{description}}' payment is due tomorrow ({{date}})",
                    "EXPENSE_OVERDUE" to "'{{description}}' payment deadline has expired ({{date}})",
                    "TASK_ASSIGNED" to "You have been assigned a new task: {{title}}",
                    "TASK_DEADLINE_SOON" to "Your task '{{title}}' is due in {{days}} day(s).",
                    "TASK_OVERDUE" to "Your task '{{title}}' is overdue! A penalty has been applied.",
                    "TASK_OVERDUE_GROUP" to "Task '{{title}}' assigned to {{assignee}} is overdue and not completed.",
                    "TASK_NUDGE" to "👋 {{sender}} gave your task '{{title}}' a friendly nudge.",
                    "WEEKLY_RECAP" to "📊 This week: {{tasksCompleted}} tasks done. Top helper: {{topContributor}}.",
                    "TASK_FEEDBACK" to "{{author}} left feedback on your task '{{title}}'.",
                    "TASK_COMPLETED_LATE" to "You completed '{{title}}' late. XP has been reduced.",
                    "TASK_SWAP_REQUESTED" to "{{fromUser}} asked you to take '{{title}}'.",
                    "TASK_SWAP_ACCEPTED" to "{{toUser}} accepted the swap for '{{title}}'.",
                    "TASK_SWAP_DECLINED" to "{{toUser}} declined the swap for '{{title}}'.",
                    "SHOPPING_ITEM_ADDED" to "{{actorName}} added '{{item}}' to the shopping list",
                    "EVENT_ADDED" to "New event: '{{title}}' on {{date}}",
                    "NEW_MESSAGE" to "{{sender}}: \"{{preview}}\"",
                    "KUDOS_RECEIVED" to "💛 {{sender}} gave you kudos: {{context}}",
                    "HOUSE_RULES_UPDATED" to "House rules were updated to version {{version}}.",
                    "GUEST_NOTICE_CREATED" to "{{host}} is having {{guest}} over on {{date}}.",
                    "GUEST_QUIET_HOURS_OVERLAP" to "{{guest}}'s visit overlaps quiet hours from {{start}}.",
                    "QUIET_HOURS_VIOLATION" to "⚠️ {{reporter}} reported a quiet-hours violation.",
                    "HOUSE_RULE_VIOLATION" to "⚠️ {{reporter}} reported a house-rule violation.",
                    // Not in ALL_NOTIFICATION_TYPES on purpose: that list drives the user-facing
                    // notification-preference toggles, and this is the one message a user stuck on
                    // a broken old build must not be able to opt out of. [AppUpdatePushService]
                    // calls the gateways directly, so the preference gate is never consulted.
                    // Worded to stay true for someone already on the newest version, because the
                    // broadcast cannot tell who is stale.
                    "APP_UPDATE_AVAILABLE" to
                        "Kollekt {{version}} is out. Open {{store}} to make sure you have the newest version.",
                ),
            "no" to
                mapOf(
                    "EXPENSE_OWED" to "{{paidBy}} betalte for '{{description}}' — du skylder {{amount}} kr",
                    "EXPENSE_DEADLINE_SOON" to "Betaling for '{{description}}' forfaller i morgen ({{date}})",
                    "EXPENSE_OVERDUE" to "Betalingsfristen for '{{description}}' har utløpt ({{date}})",
                    "TASK_ASSIGNED" to "Du har fått tildelt en ny oppgave: {{title}}",
                    "TASK_DEADLINE_SOON" to "Oppgaven '{{title}}' forfaller om {{days}} dag(er).",
                    "TASK_OVERDUE" to "Oppgaven '{{title}}' er forfalt! En straff har blitt ilagt.",
                    "TASK_OVERDUE_GROUP" to "Oppgaven '{{title}}' tildelt {{assignee}} er forfalt og ikke fullført.",
                    "TASK_NUDGE" to "👋 {{sender}} ga oppgaven '{{title}}' et vennlig dytt.",
                    "WEEKLY_RECAP" to "📊 Denne uken: {{tasksCompleted}} oppgaver fullført. Toppbidragsyter: {{topContributor}}.",
                    "TASK_FEEDBACK" to "{{author}} ga tilbakemelding på oppgaven din '{{title}}'.",
                    "TASK_COMPLETED_LATE" to "Du fullførte '{{title}}' for sent. XP er redusert.",
                    "TASK_SWAP_REQUESTED" to "{{fromUser}} spurte om du kan ta '{{title}}'.",
                    "TASK_SWAP_ACCEPTED" to "{{toUser}} godtok byttet for '{{title}}'.",
                    "TASK_SWAP_DECLINED" to "{{toUser}} avslo byttet for '{{title}}'.",
                    "SHOPPING_ITEM_ADDED" to "{{actorName}} la til '{{item}}' i handlelisten",
                    "EVENT_ADDED" to "Ny hendelse: '{{title}}' den {{date}}",
                    "NEW_MESSAGE" to "{{sender}}: \"{{preview}}\"",
                    "KUDOS_RECEIVED" to "💛 {{sender}} ga deg kudos: {{context}}",
                    "HOUSE_RULES_UPDATED" to "Husreglene ble oppdatert til versjon {{version}}.",
                    "GUEST_NOTICE_CREATED" to "{{host}} får besøk av {{guest}} den {{date}}.",
                    "GUEST_QUIET_HOURS_OVERLAP" to "Besøket til {{guest}} overlapper stilletiden fra {{start}}.",
                    "QUIET_HOURS_VIOLATION" to "⚠️ {{reporter}} meldte om brudd på stilletid.",
                    "HOUSE_RULE_VIOLATION" to "⚠️ {{reporter}} meldte om brudd på husreglene.",
                    "APP_UPDATE_AVAILABLE" to
                        "Kollekt {{version}} er ute. Åpne {{store}} for å sjekke at du har den nyeste versjonen.",
                ),
            "sv" to
                mapOf(
                    "EXPENSE_OWED" to "{{paidBy}} betalade för '{{description}}' — du är skyldig {{amount}} kr",
                    "EXPENSE_DEADLINE_SOON" to "Betalning för '{{description}}' förfaller imorgon ({{date}})",
                    "EXPENSE_OVERDUE" to "Betalningsfristen för '{{description}}' har gått ut ({{date}})",
                    "TASK_ASSIGNED" to "Du har tilldelats en ny uppgift: {{title}}",
                    "TASK_DEADLINE_SOON" to "Uppgiften '{{title}}' förfaller om {{days}} dag(ar).",
                    "TASK_OVERDUE" to "Uppgiften '{{title}}' är försenad! Ett straff har tillämpats.",
                    "TASK_OVERDUE_GROUP" to "Uppgiften '{{title}}' tilldelad {{assignee}} är försenad och ej slutförd.",
                    "TASK_NUDGE" to "👋 {{sender}} gav uppgiften '{{title}}' en vänlig knuff.",
                    "WEEKLY_RECAP" to "📊 Den här veckan: {{tasksCompleted}} uppgifter klara. Toppbidragare: {{topContributor}}.",
                    "TASK_FEEDBACK" to "{{author}} gav feedback på din uppgift '{{title}}'.",
                    "TASK_COMPLETED_LATE" to "Du slutförde '{{title}}' för sent. XP har minskats.",
                    "TASK_SWAP_REQUESTED" to "{{fromUser}} frågade om du kan ta '{{title}}'.",
                    "TASK_SWAP_ACCEPTED" to "{{toUser}} accepterade bytet för '{{title}}'.",
                    "TASK_SWAP_DECLINED" to "{{toUser}} avböjde bytet för '{{title}}'.",
                    "SHOPPING_ITEM_ADDED" to "{{actorName}} lade till '{{item}}' i inköpslistan",
                    "EVENT_ADDED" to "Ny händelse: '{{title}}' den {{date}}",
                    "NEW_MESSAGE" to "{{sender}}: \"{{preview}}\"",
                    "KUDOS_RECEIVED" to "💛 {{sender}} gav dig kudos: {{context}}",
                    "HOUSE_RULES_UPDATED" to "Husreglerna uppdaterades till version {{version}}.",
                    "GUEST_NOTICE_CREATED" to "{{host}} får besök av {{guest}} den {{date}}.",
                    "GUEST_QUIET_HOURS_OVERLAP" to "{{guest}}s besök överlappar tyst tid från {{start}}.",
                    "QUIET_HOURS_VIOLATION" to "⚠️ {{reporter}} anmälde en överträdelse av tyst tid.",
                    "HOUSE_RULE_VIOLATION" to "⚠️ {{reporter}} anmälde en överträdelse av husreglerna.",
                    "APP_UPDATE_AVAILABLE" to
                        "Kollekt {{version}} är ute. Öppna {{store}} för att se till att du har den senaste versionen.",
                ),
            "da" to
                mapOf(
                    "EXPENSE_OWED" to "{{paidBy}} betalte for '{{description}}' — du skylder {{amount}} kr",
                    "EXPENSE_DEADLINE_SOON" to "Betaling for '{{description}}' forfalder i morgen ({{date}})",
                    "EXPENSE_OVERDUE" to "Betalingsfristen for '{{description}}' er udløbet ({{date}})",
                    "TASK_ASSIGNED" to "Du har fået tildelt en ny opgave: {{title}}",
                    "TASK_DEADLINE_SOON" to "Opgaven '{{title}}' forfalder om {{days}} dag(e).",
                    "TASK_OVERDUE" to "Opgaven '{{title}}' er forfalden! En straf er blevet pålagt.",
                    "TASK_OVERDUE_GROUP" to "Opgaven '{{title}}' tildelt {{assignee}} er forfalden og ikke fuldført.",
                    "TASK_NUDGE" to "👋 {{sender}} gav opgaven '{{title}}' et venligt skub.",
                    "WEEKLY_RECAP" to "📊 Denne uge: {{tasksCompleted}} opgaver fuldført. Topbidragyder: {{topContributor}}.",
                    "TASK_FEEDBACK" to "{{author}} gav feedback på din opgave '{{title}}'.",
                    "TASK_COMPLETED_LATE" to "Du fuldførte '{{title}}' for sent. XP er reduceret.",
                    "TASK_SWAP_REQUESTED" to "{{fromUser}} spurgte, om du kan tage '{{title}}'.",
                    "TASK_SWAP_ACCEPTED" to "{{toUser}} accepterede byttet for '{{title}}'.",
                    "TASK_SWAP_DECLINED" to "{{toUser}} afviste byttet for '{{title}}'.",
                    "SHOPPING_ITEM_ADDED" to "{{actorName}} tilføjede '{{item}}' til indkøbslisten",
                    "EVENT_ADDED" to "Ny begivenhed: '{{title}}' den {{date}}",
                    "NEW_MESSAGE" to "{{sender}}: \"{{preview}}\"",
                    "KUDOS_RECEIVED" to "💛 {{sender}} gav dig kudos: {{context}}",
                    "HOUSE_RULES_UPDATED" to "Husreglerne blev opdateret til version {{version}}.",
                    "GUEST_NOTICE_CREATED" to "{{host}} får besøg af {{guest}} den {{date}}.",
                    "GUEST_QUIET_HOURS_OVERLAP" to "{{guest}}s besøg overlapper stilleperioden fra {{start}}.",
                    "QUIET_HOURS_VIOLATION" to "⚠️ {{reporter}} anmeldte en overtrædelse af stilletiden.",
                    "HOUSE_RULE_VIOLATION" to "⚠️ {{reporter}} anmeldte en overtrædelse af husreglerne.",
                    "APP_UPDATE_AVAILABLE" to
                        "Kollekt {{version}} er ude. Åbn {{store}} for at sikre, at du har den nyeste version.",
                ),
        )

    private val PARAM_PATTERN = Regex("\\{\\{(\\w+)}}")

    /** Resolves title/body for a member's language, falling back to Norwegian then a generic string. */
    fun resolve(
        language: String?,
        type: String,
        params: Map<String, String>,
    ): Pair<String, String> {
        val lang = language?.takeIf { TITLES.containsKey(it) } ?: "no"
        val title = TITLES[lang]?.get(type) ?: TITLES["no"]?.get(type) ?: "Kollekt"
        val bodyTemplate = BODIES[lang]?.get(type) ?: BODIES["no"]?.get(type)
        val body =
            bodyTemplate?.let { interpolate(it, params) }
                ?: params.values.firstOrNull()
                ?: "You have a new notification"
        return title to body
    }

    private fun interpolate(
        template: String,
        params: Map<String, String>,
    ): String = PARAM_PATTERN.replace(template) { match -> params[match.groupValues[1]] ?: match.value }

    /** In-app route a tap on this notification type should deep-link to. Shared by every push
     *  gateway ([ApnsPushService], [FcmPushService]) so the mapping is defined once. */
    fun routeFor(type: String): String =
        when {
            type.startsWith("TASK_") || type == "SHOPPING_ITEM_ADDED" -> "/tasks"
            type == "NEW_MESSAGE" -> "/chat"
            type.startsWith("EXPENSE_") -> "/economy"
            type == "KUDOS_RECEIVED" || type == "WEEKLY_RECAP" -> "/social"
            type == "EVENT_ADDED" -> "/calendar"
            else -> "/"
        }
}

# Podio Exploration Summary
Generated: 2026-04-30T08:19:13.698Z


# APP DEFINITIONS

## Test Results app — "Test Results" (app_id=16234798, space=4275251)
  - [125912760] title-2 (calculation): Summary
  - [125911620] title (text): examinee
  - [183708552] test-description (calculation): Test Description
  - [202661194] last-error-message (text): Error Log
  - [185302350] field-3 (calculation): ==>
  - [202661666] status (category): 0) Processing Status opts=[1:Active | 2:Error | 3:Error Resolved]
  - [149821869] contact-processing (category): ACTION 1) Contact Processing opts=[1:Not Processed | 2:Process Now | 3:Processed | 5:Error | 4:Not Applicable]
  - [133039300] test-status (category): ACTION 2) Test & PT Processing opts=[1:Not Processed | 3:Process Now | 2:Processed | 5:Skipped | 4:Not Applicable]
  - [125936524] results-url (text): Results URL(text)
  - [171918764] action-3-add-test-commentary (category): ACTION 3) Add Test Commentary opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Not Applicable]
  - [125936703] results-url-2 (embed): Results URL(link)
  - [184537890] action-4-complete-chapter-on-progress-tracker (category): ACTION 4) Complete Chapter on Progress Tracker opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Not Applicable]
  - [215264813] action-5-notify-coach-of-new-test-result (category): ACTION 5) Notify Coach of new Test Result opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Not Applicable]
  - [161027883] field-2 (calculation): ==>
  - [125914549] contact (app): Contact -> apps[14660191:Contacts]
  - [185302351] pt-table-feed (calculation): PT Table Feed
  - [125913339] examinee (calculation): Examinee
  - [147819789] emailtest (text): EmailTest
  - [125937527] results-urlcalc (calculation): View Results | CCO Staff
  - [150750509] view-results-students (calculation): View Results | Students
  - [146183536] test-source (category): Test Source opts=[2:ProProfs | 1:Classmarker | 3:CM Dev | 4:Xenforo]
  - [128205567] progress-tracker-type (category): Progress Tracker Type opts=[19:NA | 1:Blitz / Practice Exam | 2:CEU | 15:PCO | 5:FBC | 13:IBC | 11:ICD-10-CM | 12:ICD-10-PCS | 17:IPC | 14:MCP | 4:MTA | 16:PATHO | 6:PBB | 3:PBC | 7:PBMA | 18:PHARM | 9:PPM | 8:RAC | 20:QPIN | 10:TBD]
  - [127697573] relationship (app): Progress Tracker -> apps[16163523:Progress Tracker]
  - [132890996] bug-report (app): Bug Report -> apps[16976639:Bug Reports]
  - [125935780] date-taken (date): Date Taken
  - [132891113] notes (text): Notes
  - [142217973] relationship-2 (app): Exam Lookup -> apps[16243239:Tests]
  - [125913681] testtestid (text): test__test_id
  - [125911836] test-name (text): test__test_name
  - [150751888] testtesttitle (text): test__test_title
  - [125977751] course (text): Course
  - [128203901] course-lookup (app): Course Lookup -> apps[]
  - [147831161] resultid (text): result__ID
  - [125911826] resultemail (email): result__email
  - [125913230] text-4 (text): result__first
  - [125911818] resultlast (text): result__last
  - [125911831] resultpercentage (number): result__percentage
  - [125913685] resultcertificateurl (text): result__certificate_url
  - [125911830] resultpointsscored (number): result__points_scored
  - [125913682] resultpointsavailable (number): result__points_available
  - [125913689] resultpercentagepassmark (number): result__percentage_passmark
  - [125911820] resultpassed (text): result__passed
  - [125911819] resultaccesscodequestion (text): result__access_code_question
  - [125913679] resultextrainfoquestion (text): result__extra_info_question
  - [125911824] resultextrainfoanswer (text): result__extra_info_answer
  - [125911823] resultextrainfo2question (text): result__extra_info2_question
  - [125911829] text-2 (text): Text
  - [125913680] resultextrainfoanswer2 (text): result__extra_info_answer2
  - [125913226] resultextrainfo3question (text): result__extra_info3_question
  - [125913227] resultextrainfo3answer (text): result__extra_info3_answer
  - [125913678] resultextrainfo4question (text): result__extra_info4_question
  - [125911834] resultextrainfo4answer (text): result__extra_info4_answer
  - [125913677] resultextrainfo5question (text): result__extra_info5_question
  - [125911828] text (text): result__extra_info5_answer
  - [125911821] resultgivecertificateonlywhenpassed (text): result__give_certificate_only_when_passed
  - [125911822] resultaccesscodeused (text): result__access_code_used
  - [125913688] resulttimestarted (text): result__time_started
  - [125911833] resulttimefinished (text): result__time_finished
  - [125911832] resultduration (duration): result__duration
  - [125913225] resultrequiresgrading (text): result__requires_grading
  - [125913683] resultfeedback (text): result__feedback
  - [125913684] resultipaddress (text): result__ip_address
  - [125913686] resultcmuserid (text): result__cm_user_id
  - [125913687] resultlinkresultid (text): result__link_result_id
  - [125913228] linklinkid (text): link__link_id
  - [125911827] linklinkurlid (text): link__link_url_id
  - [125911825] linklinkname (text): link__link_name
  - [125911835] text-3 (text): payload_type
  - [125913229] payloadstatus (text): payload_status
  - [134303498] email-to-be-sent (app): Email to be sent -> apps[16269487:Automated Responses]
  - [136038030] automatic-email-status (category): Auto Results Email | Status opts=[2:Not Sent | 3:Sent | 1:NA]
  - [173027078] trigger-date (date): Auto Results Email | Trigger Date & Time
  - [150754602] field (calculation): ==>
  - [184535745] created-date-time-h (calculation): Created Date & Time [H]
  - [150754589] h-podio-test-results-id-feed (calculation): Podio Test Results ID Feed [H]
  - [159495002] debugging-trace-h (text): Debugging Trace [H]
  - [159494861] podio-item-id-text-h (text): Podio Item ID Text [H]
  - [184535646] reprocessing-trigger-count-h (number): Reprocessing Trigger Count [H]
  - [194106469] last-reprocessing-trigger-time-date-h (date): Last Reprocessing Trigger Time & Date [H]
  - [176374871] email-tracking (calculation): Email Tracking

## Contacts app — "Contacts" (app_id=14660191, space=4201014)
  - [125522304] title (calculation): Title
  - [276694071] cco-member-id (text): CCO Member ID
  - [127886375] contact (calculation): Contact
  - [150289011] dev-temp-2 (category): Dev temp opts=[1:Yes]
  - [153323126] dev-temp-3 (category): Dev temp opts=[1:test]
  - [276695087] cco-member-id-2 (text): CCO Member ID
  - [150080454] dev-temp (category): dev temp opts=[1:Yes]
  - [236064524] name-status-for-reference-layout (calculation): Name & Club
  - [125500467] hubspot-link-2 (text): Hubspot Link
  - [133631783] field-5 (calculation): ==>
  - [138740129] relationship-2 (app): Bug Report -> apps[16976639:Bug Reports]
  - [112436965] name (text): Name
  - [272884450] status-alerts (category): Status Alerts opts=[1:Banned | 2:Guarded | 3:No Email]
  - [139735987] phone (phone): DO NOT USE | Phone
  - [125500466] nanacast-link (text): Nanacast Link
  - [127290285] high-level-alert-note (text): High Level Alert Note
  - [125325798] hubspot-link (text): Hubspot Link
  - [267138856] other-note (text): Other Note
  - [211066458] phone-stripped (calculation): Phone Stripped
  - [211066617] phone-stripped-2 (calculation): Phone Stripped
  - [273667474] circle-profile-link (embed): Circle Profile Link
  - [274142323] circle-bio (text): Circle Bio
  - [126186418] hubspot-link-3 (calculation): Hubspot Link
  - [127596015] hubspot-link-4 (text): HubSpot Link
  - [274159219] circle-profession (text): Circle Profession
  - [126186383] nanacast-link-2 (calculation): Nanacast Link
  - [127661959] link (embed): Link
  - [274159220] circle-referred-by (text): Circle Referred By
  - [272985894] ps-group-dm-on-circle (embed): PS Group DM on Circle
  - [276373786] circle-hd-direct-message-link-2 (calculation): Circle HD Direct Message Link
  - [273577244] circle-hd-direct-message-link (embed): Circle HD Direct Message Link
  - [113676693] related-ticket (app): Related Ticket -> apps[14601267:RETIRED CCO Projects]
  - [127600270] nanacast-link-3 (text): Nanacast Link
  - [112436972] notes (text): Internal Notes
  - [113676694] notes-2 (text): Notes
  - [112436968] email-address (email): Email Address
  - [208298886] email-address-status (category): Email Address Status opts=[1:Unknown | 2:Valid | 3:Bounced | 4:Unsubscribed | 5:Spam]
  - [112436969] phone-number (phone): Phone Number
  - [112436970] address (location): Address
  - [133632082] new-ssh-invitation-history (text): [NEW DNU] SSH Invitation History
  - [112436967] organization (tag): Organization
  - [112436966] job-title (text): Job Title
  - [125650937] table-of-shopify-orders (calculation): Table of Shopify Orders
  - [125655208] calculation (calculation): Calculation
  - [125311532] credentials (text): Credentials
  - [210629082] access-issue-task (category): Fix Access Issue or Merge Contact (Post Comment About Exact Help Needed) opts=[1:Assign Task to Jesus to Fix | 2:Access Corrected]
  - [274159221] circle-credentials-desired (text): Circle Credentials Desired
  - [274159222] circle-biggest-pain-point (text): Circle Biggest Pain Point
  - [274330225] what-best-describes-you (category): What Best Describes You? opts=[1:Certified coder seeking additional certifications | 2:Medical coder or student seeking certification | 3:Certified professional looking to stay certified | 4:Nurse looking for a new career | 5:Exploring medical coding as a new career | 6:Medical office manager with many hats | 7:Physician seeking medical coding expertise]
  - [112437086] contact-type (category): Contact Type opts=[18:Advocate | 26:BHAT™ Interview | 3:Business | 17:Candidate | 19:CCO Team | 7:Chapter Officer | 13:Coach | 25:Competition | 6:Consultant | 9:Customer | 8:Door Prize Winner | 5:Employee | 10:Friends/Family | 15:Guest Blogger | 14:Helpdesk Agent | 32:Intern Applicant | 30:Intern | 11:Lead | 28:Organization | 31:Partner | 20:Podio Consultant | 27:Potential SME | 23:Scholarship Receipient | 2:SME | 24:Speaker | 1:Student | 21:SWAG Vendor | 29:Topic Requester | 22:Upwork Staff | 12:Vendor | 16:Delete | 4:Other]
  - [112436974] skype-id (text): Skype ID
  - [112437149] twitter-handle (text): Twitter Handle
  - [125865451] related-contact-item (app): Related Contact Item -> apps[14660191:Contacts]
  - [140012791] temp-pete (category): TEMP | Pete opts=[1:To Check Again]
  - [112437148] facebook-page (embed): Facebook Page
  - [144195039] ssh-pending-invitations (calculation): SSH Pending Invitations
  - [274159225] instagram (embed): Instagram
  - [274159224] linkedin (embed): LinkedIn
  - [112437150] public-profile (text): Public Profile / Bio
  - [148055039] search-fail-count (number): Search Fail Count
  - [112436971] website (embed): Website
  - [144198049] podio-cco-username-status (calculation): Podio CCO Username Status
  - [112436973] photo (image): Photo
  - [144198050] podio-cco-username (calculation): Podio CCO Username
  - [143548289] action (category): Action opts=[1:*Create NDA Task | 2:*Create Internship Agreement Task | 4:*Send Internship Onboarding Email | 6:*Send Internship Inactivity Email | 5:*Send Account Merged Email | 3:*Send Merged Email | 7:Create New HD Ticket]
  - [132622435] podio-profile (embed): [HIE] DO NOT USE | Podio Profile Link
  - [155999888] agreements-table (calculation): Agreements Table
  - [113676692] nda (category): NDA [Retired] opts=[1:Needed | 5:Send Now | 2:Sent | 3:Signed | 4:Completed]
  - [140472747] internship-agreement (category): Internship Agreement [Retired] opts=[1:Send Now | 2:Sent | 3:Signed]
  - [125310002] table-of-other-related-items (calculation): Table of Other Related Items
  - [197369622] wo150-development-notes (calculation): WO150 & WO151 | Development Notes
  - [257661030] link-to-intern-workspace-app (app): Link to Intern Workspace App -> apps[]
  - [125309996] field (calculation): ➪
  - [134218374] field-10 (calculation): ==>
  - [134218375] subscription-status (category): CCO Club Subscription Status opts=[10:Never | 1:Not Active | 8:Monthly (Grandfathered) | 7:Monthly (26) | 2:Active Annual | 9:Monthly | 3:Lapsed Monthly (Grandfathered) | 6:Lapsed Annual | 5:Intern | 4:Lost]
  - [273632237] extension-status (category): Extension Status opts=[1:On | 2:Off]
  - [199828107] suspend-system-access (category): Suspend Systems Access opts=[1:Suspend | 3:Reinstate | 2:Remove]
  - [180364543] last-nanacast-cco-club-transaction (app): CCO Club | Last Successful Nanacast Transaction -> apps[16274502:All Orders, 30441980:Circle Webhooks]
  - [180364542] last-successful-nanacast-cco-club-transaction-date (date): CCO Club | Last Successful Nanacast Transaction Date
  - [125310320] field-2 (calculation): ➪
  - [134218376] latest-nanacast-subscription-expiry-date (date): CCO Club | Lapse Date
  - [125310001] table-of-subscriptions (calculation): Table of Nanacast Subscriptions
  - [183317383] cco-club-prime-transaction-detected (category): CCO Club Prime | Transaction Detected opts=[1:True]
  - [125650938] table-of-shopify-orders-2 (calculation): Table of Shopify Orders
  - [184026827] cco-club-prime-next-cron-job-trigger (date): CCO Club Prime | Next CRON Job Trigger
  - [125310000] table-of-help-desk-tickets (calculation): Table of Help Desk Tickets
  - [184023952] recent-cco-club-prime-nanacast-transactions (app): CCO Club Prime & Plus | Recent Nanacast Transactions -> apps[16274502:All Orders]
  - [273731549] extension-eligible (category): Extension Eligible opts=[1:PBC | 2:FBC | 3:RAC | 4:PBB | 5:IPC | 6:I10CM | 7:I10PCS | 8:MTA | 9:PATHO | 10:PHARM | 11:AMCAA | 12:QPIN | 13:MCRB | 14:MBRB | 15:MARB | 16:ICRB | 17:OCRB | 18:RARB | 19:I10CMMRB | 20:I10PCSRB]
  - [273731550] lifetime (category): Lifetime opts=[1:PBC | 2:FBC | 3:RAC | 4:PBB | 5:IPC | 6:I10CM | 7:I10PCS | 8:MTA | 9:PATHO | 10:PHARM | 11:AMCAA | 12:QPIN | 13:MCRB | 14:MARB | 15:ICRB | 16:OCRB | 17:RARB | 18:I10CMRB | 19:I10PCSRB | 20:CDI]
  - [185302332] field-12 (calculation): ==>
  - [185302333] pt-table (calculation): PT Table
  - [130186876] email-for-search (calculation): [IN DEV] Email for Search
  - [273005277] progress-tracker-lookup (app): Progress Tracker Lookup -> apps[16163523:Progress Tracker]
  - [125540187] temp-link (app): [DELETE?] Temp Link -> apps[15817104:Help Desk Tickets]
  - [139153375] dev-gf-flow-that-created-this-contact (embed): [DEV] GF Flow That Created This Contact
  - [133632081] field-9 (calculation): ==>
  - [127600269] text (text): [DELETE?] Text
  - [272798527] reset-password (category): Reset Password opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Error]
  - [199426794] contacts-default-system-username-master-h (text): Contact's Default System Username MASTER [H]
  - [199426950] contacts-default-system-username (calculation): Contact's Default System Username
  - [199172888] pp-wf-password-master-h (text): Contact's Default System Password MASTER [H]
  - [139187585] dev-reviewed-to-this-point (category): [DEV] Reviewed To This Point opts=[1:Active]
  - [199172889] pp-wf-password (calculation): Contact's Default System Password
  - [199121590] get-create-proprofs-user-id (category): [RET 11/2024] Create / Set ProProfs User ID & Password opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Error | 5:STOP]
  - [197369623] proprofs-user-id (text): [RET 11/2024] ProProfs User ID
  - [146954242] field-11 (calculation): ==>
  - [199121591] get-create-xenforo-user-id (category): Create / Set Xenforo User ID & Password opts=[1:Not Done | 2:Do It Now | 6:Update | 3:Done | 4:Error | 5:STOP]
  - [272864098] update-xenforo-password (category): Update Xenforo Password opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Error]
  - [199121592] xenforo-user-id (text): Xenforo User ID
  - [272609490] create-set-circle-user-id-password (category): Create / Set Circle User ID & Password opts=[1:Not Done | 2:Do It Now | 3:Update | 4:Done | 5:Error | 6:STOP]
  - [275925353] create-ps-group-dm-in-circle (category): Create PS Group DM in Circle  opts=[1:Not Done | 2:Do It Now | 3:Update | 4:Done | 5:Error | 6:STOP]
  - [272609487] circle-user-id (text): Circle User ID
  - [203442371] xenforo-user-link (calculation): Xenforo User Link
  - [200186024] send-default-systems-welcome-email (category): Send Default Systems Welcome Email opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Error | 5:STOP]
  - [200187416] default-systems-welcome-email-sent-date (date): Default Systems Welcome Email Last Sent Date
  - [272798528] send-circle-invitation-email-new-cco-academy-access (category): Send Circle Invitation Email - New CCO Academy Access opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Error | 5:STOP]
  - [272798668] circle-invitation-email-last-sent-date (date): Circle Invitation Email Last Sent Date
  - [133632083] new-invite-to-new-sshs (app): Podio | Invite To New SSHs -> apps[16812156:Workspace Lookup]
  - [133632084] new-new-ssh-invitation-status (category): Podio | Invitation Status opts=[1:Not Invited | 2:Invite Now | 3:Errors To Address | 4:Invited]
  - [163643325] trigger-pending-ssh-invitations (category): Podio | Trigger Pending SSH Invitations opts=[1:Do It Now]
  - [202611118] ssh-invitations-show-most-recent (category): SSH Invitations | Show Most Recent opts=[2:10 | 3:30 | 1:All]
  - [133655061] new-ssh-invitation-history-table (calculation): SSH Invitation | History Table
  - [168596565] h-bug270-status (category): [H] BUG270 Status opts=[1:Ignore (new record) | 2:Check Now | 3:Done]
  - [171920001] field-17 (calculation): ==>
  - [150824550] average-test-result-percentage (calculation): Average Test Result Percentage
  - [150754145] test-result-dashboard (calculation): All Test Results Dashboard
  - [133631785] field-7 (calculation): ==>
  - [274800976] health-checks (calculation): Health Checks
  - [144726154] podio-user-profile (calculation): Podio User Profile
  - [147989074] search-for-podio-user-id (category): Search For Podio User ID opts=[1:Not Done | 2:Do It Now | 3:Done | 5:Email Not Found On Any Podio User Profile | 4:API Time Out | Try Again Soon]
  - [131663986] podio-user-id (text): Podio User ID
  - [140324905] in-dev-podio-cco-username (text): Podio CCO Username
  - [140325019] in-dev-podio-cco-username-status (category): Podio CCO Username Status opts=[1:Not Activated | 2:Pending Activation | 3:Activated | 4:Manual Override]
  - [144195949] podio-cco-username-activation (app): Podio CCO Username Activation -> apps[18238825:[RET] Activations]
  - [133631782] field-4 (calculation): ==>
  - [125701761] statusaction (category): Duplicate Status opts=[6:Not Checked | 5:Check Now | 3:ACTIVE | 7:No Email Address To Check | 4:SUSPECTED DUPLICATE | 1:CONFIRMED DUPLICATE | 2:Merge]
  - [128321272] duplicate-entries (app): Duplicate Entries -> apps[14660191:Contacts]
  - [133631784] field-6 (calculation): ==>
  - [204029025] nanacast-transactions-show-most-recent (category): Nanacast Transactions | Show Most Recent opts=[1:10 | 2:30 | 3:All]
  - [274590251] sales-transactions-history-table (calculation): Sales Transactions History Table
  - [159372608] nanacast-transactions-history (calculation): Nanacast Transactions History Table
  - [127945567] nanacast-link-4 (embed): Nanacast Link
  - [125309997] nanacast-account-id (text): Nanacast Account ID
  - [128515550] nanacast-password (text): Nanacast Password
  - [127662181] hubspot-link-5 (embed): HubSpot Link
  - [125309998] shopify-customer-id (text): Shopify Customer ID
  - [125309999] accepts-marketing-shopify (category): Shopify Accepts Marketing? opts=[1:yes | 2:no]
  - [127662180] link-2 (embed): Link
  - [133453200] interest-lists (app): Interest Lists -> apps[17102034:Interest Lists]
  - [205885568] bug324-processed-h (category): BUG324 | Processed [H] opts=[1:True]
  - [129404323] field-3 (calculation): ==>
  - [127525329] cco-staff-podio-profile (contact): CCO Staff Podio Profile
  - [267463615] cco-staf-podio-profile-user-id (text): CCO Staff Podio Profile User ID
  - [145998468] h-cco-staff-podio-profile-for-search (calculation): CCO Staff Podio Profile For Search [H]
  - [134582853] auto-create-weekly-bests-timesheets (category): Auto Create Weekly Bests & Timesheets opts=[1:Salaried | 2:W2 - Hourly | 3:Upwork | 4:1099 Contractor | 5:Intern | 6:TEMP TEST | 7:Other]
  - [165818230] manual-trigger-create-weekly-best-for-current-period (category): Manual Trigger | Create Weekly Best  for Current Period opts=[1:Do It Now | See Comments For Outcome]
  - [173563648] intern-google-group-email (text): Intern Google Group Email
  - [251040161] intern-email (text): Intern Email
  - [251040162] intern-password (text): Intern Password
  - [129404517] cco-team-skills (category): CCO Team / Skills opts=[4:SME | 7:Researcher | 12:Presenter | 5:Coach | 6:Instructor | 15:Exam Question Specialist | 2:VA | 11:Help Desk | 16:Social Media Specialist | 1:Transcriptionist | 3:Video Producer | 8:Reviewer (Support Call) | 9:Reviewer (Technical) | 10:Enrollment / Product Specialist | 13:Webmaster | 14:Project Manager | 17:Leadership]
  - [128419377] timetrade-links (text): TimeTrade Link(s)
  - [134730066] relationship (app): Related App Items -> apps[15817104:Help Desk Tickets]
  - [227871450] wo170-processing-backlog-h (category): WO170 Processing Backlog [H] opts=[1:Not Applicable | 2:Done]
  - [127782962] helpdesk-search (calculation): Clean Name Search
  - [133631786] field-8 (calculation): ==>
  - [139256403] how-was-this-record-created (text): How Was This Record Created?
  - [146954243] total-post-count (number): Total SSH Forum Post Count
  - [146954244] total-comments-count (number): Total SSH Forum Comments Count
  - [146954245] last-post-date (date): SSH Forum Last Post Date
  - [146954246] last-comment-date (date): SSH Forum Last Comment Date
  - [150544555] intern-workspace-statuses (number): Intern Workspace Statuses
  - [150544556] intern-workspace-comments (number): Intern Workspace Comments
  - [150544557] intern-workspace-last-activity (date): Intern Workspace Last Activity
  - [150544558] intern-projects-comments (number): Intern Projects Comments
  - [150544560] intern-projects-last-activity (date): Intern Projects Last Activity [H]
  - [150544559] intern-nuggets-comments (number): Intern Nuggets Comments
  - [150544561] intern-nuggets-last-activity (date): Intern Nuggets Last Activity
  - [150544562] last-seen-on (date): Last Seen On [H]
  - [147089347] url-to-this-contact-item (calculation): URL to this contact item [H]
  - [203037165] field-23 (calculation): ==>
  - [199672471] error-count-h (number): Processing Error Count
  - [199770679] processing-error-clear (category): Processing Error Reset opts=[1:Ready | 2:Do It Now]
  - [205885567] h (calculation): ==> [H]
  - [274160433] circleusercode-h (calculation): circleUserCode [H]
  - [225371582] xenforo-pt-params-h (text): Xenforo PT params [H]
  - [272609488] circle-pt-params-h (text): Circle PT params [H]
  - [207898730] last-xenforo-json-payload-h (text): Last Xenforo JSON Payload [H]
  - [272609489] last-circle-json-payload-h (text): Last Circle JSON Payload [H]
  - [207898731] last-proprofs-json-payload-h (text): Last ProProfs JSON Payload [H]
  - [208299021] podio-item-id-text-h (text): Podio Item ID Text [H]
  - [267073781] internpid-h (calculation): internPid [H]
  - [267239858] internstotalhours-h (calculation): internsTotalHours [H]
  - [164909409] h-email-address-for-search (text): Email Address For Search [H]
  - [145324704] navigation-bar (calculation): Navigation Bar [H]
  - [172968912] h-email-signature (calculation): Email Signature [H]
  - [208270698] email-tracking (calculation): Email Tracking
  - [215170660] welcomeemaillastsend-h (date): welcomeEmailLastSend [H]
  - [274160444] wo209-podio-fields-updated-from-circle-h (category): WO209 - Podio Fields Updated from Circle [H] opts=[1:Done]
  - [274160445] wo209-circle-member-updated-with-podio-url-h (category): WO209 - Circle Member Updated with Podio Url [H] opts=[1:Done]
  - [224454659] bug341-h (category): BUG341 [H] opts=[1:Clear | 2:Flag]
  - [228174939] wo170-h (category): WO170 [H] opts=[1:Done | PT Order | 2:Done | Other Order | 3:Skip | No Order]
  - [274898169] progress-tracker-history-json (calculation): Progress Tracker History JSON
  - [274898029] help-desk-tickets (calculation): Help Desk Tickets History JSON
  - [274800096] recent-health-check (calculation): Recent Health Check
  - [272799391] created-on (calculation): Created On

## Platform Profiles app (CURRENT auth) — "CCO Platform Profiles" (app_id=30640719, space=10191082)
  - [275832532] full-name (calculation): Full Name
  - [275832533] section-1 (calculation): -
  - [275832534] person (app): Person -> apps[14660191:Contacts]
  - [275832535] name (calculation): Name
  - [275832536] first-name (text): First Name
  - [275832537] last-name (text): Last Name
  - [275832538] email-2 (text): Email
  - [275832539] password-2 (calculation): Password
  - [275832540] password (text): Password [H]
  - [275832541] confirm-password-h (text): Confirm Password [H]
  - [275832542] phone (phone): Phone
  - [275832543] status (category): Status opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Error | 5:Not Applicable | 6:Archive | 7:Active | 8:Disabled | 9:Locked | 10:Archived | 11:Duplicate]
  - [275832544] section-2 (calculation): -
  - [275832545] portal-type (category): Select Portal Type to Create  opts=[1:Intern | 2:Contract | 3:Dealer | 4:Foreman | 6:Engineer | 5:Contracts Manager]
  - [275832546] create-portal-types (category): Create Portal Type opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Error]
  - [275832547] portal-created (category): Portal Created opts=[1:Yes]
  - [275832548] send-portal-invitation (category): Send Portal Invitation opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Error]
  - [275832549] reset-password (category): Re-send Password opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Error]
  - [275832550] section-3 (calculation): Section 3
  - [275832551] last-login-date (date): Last Login Date
  - [275832552] last-lock-out-date (date): Last Lock Out Date
  - [275832553] date-of-last-reset (date): Date of Last Reset
  - [275832554] date-of-last-change (date): Date of Last Change
  - [275832555] backlink (category): Backlink opts=[1:Not Done | 2:Do It Now | 3:Done | 4:Error]
  - [275832556] section-4 (calculation): Section 4
  - [275832557] created-on (calculation): Created On
  - [275832558] master-portal-profile-migration (category): Master Portal Profile Migration opts=[1:Done]
  - [275832559] b64emailaddresses (text): b64unique [H]
  - [275832560] contactpid-h (calculation): contactPid [H]
  - [275832561] internpid-h (calculation): internPid [H]
  - [275832562] interntotalhours-h (calculation): internTotalHours [H]
  - [275832563] totalhours-h (text): totalHours [H]
  - [275832564] pid (text): pid [H]
  - [275832565] aid (text): aid [H]
  - [275832566] appid (text): appid [H]
  - [275832567] togl (text): togl [H]
  - [275832568] ltti (calculation): ltti [H]
  - [275832569] navbar (calculation): navBar [H]
  - [275832570] initmessage (text): initMessage


# EXAMPLE ITEMS

## Test Result item 126523 — item_id=3276160524, app_item_id=126523, title="Renee Busacca | 100% | July 2025 CCO Club Q&A Webinar | Wed Mar 25 2026 00:00:00 GMT+0000 (UTC)"
  [125912760] title-2 (calculation) "Summary": Renee Busacca | 100% | July 2025 CCO Club Q&A Webinar | Wed Mar 25 2026 00:00:00 GMT+0000 (UTC)
  [183708552] test-description (calculation) "Test Description": Not available
[Click to view](https://podio.com/ccous/cco-test-platform/apps/tests/items/2930)
  [185302350] field-3 (calculation) "==>": ---
  [202661666] status (category) "0) Processing Status": Active
  [149821869] contact-processing (category) "ACTION 1) Contact Processing": Processed
  [133039300] test-status (category) "ACTION 2) Test & PT Processing": Processed
  [171918764] action-3-add-test-commentary (category) "ACTION 3) Add Test Commentary": Done
  [184537890] action-4-complete-chapter-on-progress-tracker (category) "ACTION 4) Complete Chapter on Progress Tracker": Not Applicable
  [215264813] action-5-notify-coach-of-new-test-result (category) "ACTION 5) Notify Coach of new Test Result": Not Applicable
  [161027883] field-2 (calculation) "==>": ---
  [125914549] contact (app) "Contact": ref item 3275345593 (Contacts: "Renee Busacca")
  [185302351] pt-table-feed (calculation) "PT Table Feed": Type|Status|Enrolled|Completed
:---|:---|:---|:---

  [125913339] examinee (calculation) "Examinee": Renee Busacca
  [125937527] results-urlcalc (calculation) "View Results | CCO Staff": [Xenforo](https://www.cco.community/exams/results/22490) (you must be logged into Xenforo to view)
  [150750509] view-results-students (calculation) "View Results | Students": [Xenforo](https://www.cco.community/exams/results/22490) THIS LINK IS IN ALPHA TESTING as at June 26 2017
  [146183536] test-source (category) "Test Source": Xenforo
  [128205567] progress-tracker-type (category) "Progress Tracker Type": CEU
  [125935780] date-taken (date) "Date Taken": 2026-03-25 -> 
  [142217973] relationship-2 (app) "Exam Lookup": ref item 3046527757 (Tests: "July 2025 CCO Club Q&A Webinar [ID2930]")
  [125913681] testtestid (text) "test__test_id": test2930
  [125911836] test-name (text) "test__test_name": July 2025 CCO Club Q&A Webinar
  [147831161] resultid (text) "result__ID": 22490
  [125911826] resultemail (email) "result__email": :reneebusacca@gmail.com
  [125913230] text-4 (text) "result__first": Renee
  [125911818] resultlast (text) "result__last": Busacca
  [125911831] resultpercentage (number) "result__percentage": 100.0000
  [125911832] resultduration (duration) "result__duration": 183
  [136038030] automatic-email-status (category) "Auto Results Email | Status": Not Sent
  [150754602] field (calculation) "==>": # SYSTEM FIELDS
  [184535745] created-date-time-h (calculation) "Created Date & Time [H]": 
  [150754589] h-podio-test-results-id-feed (calculation) "Podio Test Results ID Feed [H]": score126523
  [159495002] debugging-trace-h (text) "Debugging Trace [H]": <p>Created via webhook: <a href="https://workflow-automation.podio.com/configureflow.php?id=2652156">https://workflow-automation.podio.com/configureflow.php?id=2652156</a></p>
  [176374871] email-tracking (calculation) "Email Tracking": ![](http://www.globimail.com/images/gm-activated-sm.png)

---------------------------------------

[Compose New Message >](http://www.globimail.com/l2/NEW2.AMlp.ypkV.score126523)

## Contacts item 96011 — item_id=3275345593, app_item_id=96011, title="Renee Busacca"
  [127886375] contact (calculation) "Contact": Renee Busacca
  [236064524] name-status-for-reference-layout (calculation) "Name & Club": Renee Busacca | Club Status: Not Active
  [133631783] field-5 (calculation) "==>": ----------------------------
# MAIN CONTACT DETAILS 
----------------------------
[Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [112436965] name (text) "Name": Renee Busacca
  [273667474] circle-profile-link (embed) "Circle Profile Link": [{"embed":{"description":null,"embed_height":null,"embed_html":null,"embed_id":1374308679,"embed_width":null,"hostname":"cco.academy","original_url":"https://www.cco.academy/u/e6801a48","resolved_url"
  [273577244] circle-hd-direct-message-link (embed) "Circle HD Direct Message Link": [{"embed":{"description":"CCO Academy community home page","embed_height":null,"embed_html":null,"embed_id":1375256074,"embed_width":null,"hostname":"cco.academy","original_url":"https://www.cco.acade
  [112436968] email-address (email) "Email Address": :reneebusacca@gmail.com
  [208298886] email-address-status (category) "Email Address Status": Valid
  [125311532] credentials (text) "Credentials": CPB, CPC-A
  [274330225] what-best-describes-you (category) "What Best Describes You?": Certified professional looking to stay certified
  [112437086] contact-type (category) "Contact Type": Customer
  [134218374] field-10 (calculation) "==>": ----------------------------
# CCO CLUB SUBSCRIPTION STATUS 
----------------------------
[Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [134218375] subscription-status (category) "CCO Club Subscription Status": Not Active
  [185302332] field-12 (calculation) "==>": ----------------------------
# PROGRESS TRACKERS 
----------------------------
[Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [185302333] pt-table (calculation) "PT Table": Type|Status|Enrolled|Completed
:---|:---|:---|:---

  [133632081] field-9 (calculation) "==>": ----------------------------
# STUDENT SUPPORT HUBS 
----------------------------
[Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [199426794] contacts-default-system-username-master-h (text) "Contact's Default System Username MASTER [H]": ReneeB_96011
  [199426950] contacts-default-system-username (calculation) "Contact's Default System Username": ReneeB_96011
  [199172888] pp-wf-password-master-h (text) "Contact's Default System Password MASTER [H]": RB5593!
  [199172889] pp-wf-password (calculation) "Contact's Default System Password": RB5593!
  [199121591] get-create-xenforo-user-id (category) "Create / Set Xenforo User ID & Password": Done
  [199121592] xenforo-user-id (text) "Xenforo User ID": 40446
  [272609490] create-set-circle-user-id-password (category) "Create / Set Circle User ID & Password": Done
  [275925353] create-ps-group-dm-in-circle (category) "Create PS Group DM in Circle ": Not Done
  [272609487] circle-user-id (text) "Circle User ID": 78764927
  [203442371] xenforo-user-link (calculation) "Xenforo User Link": [Click here](https://www.cco.community/admin.php?users/40446/edit)
  [200186024] send-default-systems-welcome-email (category) "Send Default Systems Welcome Email": Done
  [200187416] default-systems-welcome-email-sent-date (date) "Default Systems Welcome Email Last Sent Date": 2026-03-23 20:52:15 -> 
  [133655061] new-ssh-invitation-history-table (calculation) "SSH Invitation | History Table": Date | Mem | Method | Status | Link 
---  | --- | ---    | ---    | ---  
03/23/2026|cco-club-monthly-26|Circle,Xenforo|Active|[Link](https://podio.com/ccous/course-management/apps/student-invitations-processing/items/147761)

  [171920001] field-17 (calculation) "==>": ----------------------------
# STUDENT TESTS 
----------------------------
[Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [150824550] average-test-result-percentage (calculation) "Average Test Result Percentage": 87.2000
  [150754145] test-result-dashboard (calculation) "All Test Results Dashboard": Date | Test Name | Score | Download
---|---|---|---
03/24/2026 | 2026 ICD-10 Update with Find-A-Code Quiz | 70% | [Xenforo](https://www.cco.community/exams/results/22476)
03/24/2026 | 2026 CPT Update with Find-A-Code | 100% | [Xenforo](https://www.cco.community/exams/results/22478)
03/24/2026 | February 2025 CCO Club Q&A Webinar | 100% | [Xenforo](https://www.cco.community/exams/results/22479)
03/24/2026 | March 2025 CCO Club Q&A Webinar | 90% | [Xenforo](https://www.cco.community/exams/results/22485)
03/24/2026 | Battling Bugs and Parasites: Infectious Diseases (1A00-1H0Z) | 70% | [Xenforo](https://www.cco.community/exams/results/22486)
03/25/2026 | May 2025 CCO Club Q&A Webinar | 100% | [Xenforo](https://www.cco.community/exams/results/22487)
03/25/2026 | June 2025 CCO Club Q&A Webinar | 100% | [Xenforo](https://www.cco.community/exams/results/22488)
03/25/2026 | July 2025 CCO Club Q&A Webinar | 100% | [Xenforo](https://www.cco.community/exams/results/22490)
03/25/2026 | CCO Club Q&A #1097 | 90% | [Xenforo](https://www.cco.community/exams/results/22491)
03/25/2026 | September 2025 CCO Club Q&A Webinar | 50% | [Xenforo](https://www.cco.community/exams/results/22495)
03/25/2026 | September 2025 CCO Club Q&A Webinar | 100% | [Xenforo](https://www.cco.community/exams/results/22496)
03/25/2026 | Cell Rebellion: Neoplasms and Tumors (2A00-2F9Z) | 90% | [Xenforo](https://www.cco.community/exams/results/22498)
03/25/2026 | Postcoordination in ICD-11: Using Stem Codes and Extension Codes | 90% | [Xenforo](https://www.cco.community/exams/results/22499)
03/25/2026 | 2026 ICD-10-CM Update | 60% | [Xenforo](https://www.cco.community/exams/results/22500)
03/25/2026 | 2026 ICD-10-CM Update | 100% | [Xenforo](https://www.cco.community/exams/results/22501)
03/25/2026 | April 2025 CCO Club Q&A Webinar | 100% | [Xenforo](https://www.cco.community/exams/results/22502)
03/25/2026 | 2026 CPT Update with Find-A-Code | 60% | [Xenforo](https://www.cco.community/exams/results/22504)
03/25/2026 | 2026 CPT Update with Find-A-Code | 100% | [Xenforo](https://www.cco.community/exams/results/22505)
03/25/2026 | CCO Club Q&A #1732 | 74% | [Xenforo](https://www.cco.community/exams/results/22506)
03/25/2026 | CCO Club Q&A #1733 | 100% | [Xenforo](https://www.cco.community/exams/results/22508)
 | # AVERAGE: |87.2%|
  [133631785] field-7 (calculation) "==>": ----------------------------
# PODIO INFORMATION 
----------------------------
[Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [274800976] health-checks (calculation) "Health Checks": | Date | Score | Δ Score | Risk | Upgrade % | Archetype | Notes | Check |
| ---- | ----- | ------- | ---- | ---------- | --------- | ----- | ----- |
| 04/01/26 | _ 0 | 0 | _ 0 | _ 0 | — | — | [_ View](https://podio.com/ccous/hub/apps/contact-health-checks/items/3305) |
| 03/24/26 | _ 0 | — | _ 0 | _ 0 | — | — | [_ View](https://podio.com/ccous/hub/apps/contact-health-checks/items/3174) |

  [144726154] podio-user-profile (calculation) "Podio User Profile": Please activate the 'Search For Podio User ID' function below
  [133631782] field-4 (calculation) "==>": ----------------------------
# CONTACT DUPLICATE INFORMATION 
----------------------------
[Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [125701761] statusaction (category) "Duplicate Status": ACTIVE
  [133631784] field-6 (calculation) "==>": ----------------------------
# SALES TRANSACTIONS 
----------------------------
[Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [274590251] sales-transactions-history-table (calculation) "Sales Transactions History Table": Date | Description | Price | Platform | Event 
---|---|---|---|--- 
[03-23-2026](https://podio.com/1/1/item/3275345655) | cco-club-monthly-26 | $24.99 | ⭕ Circle | Paywall Charged - Webhook

  [159372608] nanacast-transactions-history (calculation) "Nanacast Transactions History Table": Date | Description | Price | Type 
---|---|---|--- 
undefined
undefined
undefined
undefined
undefined
undefined
undefined
undefined
undefined
[03-23-2026](https://podio.com/1/1/item/3275345655) | cco-club-monthly-26 | $24.99 | null

  [129404323] field-3 (calculation) "==>": ----------------------------
# EMPLOYEE INFORMATION 
----------------------------
[Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [145998468] h-cco-staff-podio-profile-for-search (calculation) "CCO Staff Podio Profile For Search [H]": null
  [127782962] helpdesk-search (calculation) "Clean Name Search": Renee Busacca
  [133631786] field-8 (calculation) "==>": ----------------------------
# SYSTEM INFORMATION 
----------------------------
[Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [147089347] url-to-this-contact-item (calculation) "URL to this contact item [H]": https://podio.com/ccous/hub/apps/contacts/items/96011
  [205885567] h (calculation) "==> [H]": Hidden fields
  [274160433] circleusercode-h (calculation) "circleUserCode [H]": 1.0000
  [207898730] last-xenforo-json-payload-h (text) "Last Xenforo JSON Payload [H]": {"success":true,"user":{"about":"","activity_visible":true,"alert_optout":[],"allow_post_profile":"none","allow_receive_news_feed":"none","allow_send_personal_conversation":"none","allow_view_identities":"none","allow_view_profile":"none","avatar_urls":{"o":null,"h":null,"l":null,"m":null,"s":null},"can_ban":false,"can_converse":true,"can_edit":true,"can_follow":true,"can_ignore":true,"can_post_profile":true,"can_view_profile":true,"can_view_profile_posts":true,"can_warn":true,"content_show_signature":false,"creation_watch_state":"watch_email","custom_fields":{"full_name":"Renee Busacca","podio_contact_link":"https:\/\/podio.com\/ccous\/hub\/apps\/contacts\/items\/96011"},"custom_title":"","email":"reneebusacca@gmail.com","email_on_conversation":true,"gravatar":"","interaction_watch_state":"watch_email","is_admin":false,"is_banned":false,"is_discouraged":false,"is_followed":false,"is_ignored":false,"is_moderator":false,"is_staff":false,"is_super_admin":false,"last_activity":1774299127,"location":"","message_count":0,"profile_banner_urls":{"l":null,"m":null},"push_on_conversation":true,"push_optout":[],"question_solution_count":0,"reaction_score":0,"receive_admin_email":true,"register_date":1774299127,"secondary_group_ids":[],"show_dob_date":false,"show_dob_year":false,"signature":"","timezone":"America\/New_York","trophy_points":0,"use_tfa":false,"user_group_id":2,"user_id":40446,"user_state":"valid","user_title":"New member","username":"ReneeB_96011","view_url":"https:\/\/www.cco.community\/members\/reneeb_96011.40446\/","visible":true,"vote_score":0,"warning_points":0,"website":""}}
  [208299021] podio-item-id-text-h (text) "Podio Item ID Text [H]": 3275345593
  [267239858] internstotalhours-h (calculation) "internsTotalHours [H]": 0
  [164909409] h-email-address-for-search (text) "Email Address For Search [H]": reneebusaccaatgmaildotcom
  [145324704] navigation-bar (calculation) "Navigation Bar [H]": [Main Details](#main-contact-details) | [CCO Club Subs](#field-10) | [PTs](#progress-trackers) | [SSH](#student-support-hubs) | [Tests](#student-tests) | [Podio](#podio-information) | [Dupes](#contact-duplicate-information) | [Sales Transactions](#sales-transactions) | [Employee Info](#employee-information)
  [172968912] h-email-signature (calculation) "Email Signature [H]": #### Renee Busacca, CPB, CPC-A

Certification Coaching Organization, LLC

e: reneebusacca@gmail.com | w: [www.cco.us](https://www.cco.us/)

[![Facebook](http://s3.amazonaws.com/ws-gapp-images/facebook.png)](https://www.facebook.com/cco.us)[![LinkedIn](http://s3.amazonaws.com/ws-gapp-images/linkedin.png)](https://www.linkedin.com/company/codingcertification-org) [![YouTube](http://s3.amazonaws.com/ws-gapp-images/youtube.png)](https://www.youtube.com/medicalcodingcert) [![Twitter](http://s3.amazonaws.com/ws-gapp-images/twitter.png)](https://twitter.com/certcoachingorg)[![blogRSS](http://s3.amazonaws.com/ws-gapp-images/blogRSS.png)](https://www.cco.us/forum/?utm_source=WiseStamp&utm_medium=email&utm_term=&utm_content=&utm_campaign=signature)[![GooglePlus](http://s3.amazonaws.com/ws-gapp-images/googlepluspage.png)](https://plus.google.com/+CodingcertificationOrg)[![Pinterest](http://s3.amazonaws.com/ws-gapp-images/pinterest.png)](https://www.pinterest.com/certcoachingorg/)[![Instagram](http://s3.amazonaws.com/ws-gapp-images/instagram.png)](https://www.instagram.com/certificationcoaching/)

[Get Certified](http://cco.us/?utm_source=WiseStamp&utm_medium=email&utm_term=&utm_content=&utm_campaign=signature) | [Stay Certified](http://cco.us/?utm_source=WiseStamp&utm_medium=email&utm_term=&utm_content=&utm_campaign=signature)

![Webinar](https://s3.amazonaws.com/images.wisestamp.com/apps/webinar/3.png ) Join Our Monthly Webinar: [Fun Free Monthly Q&A, Webinar](https://www.cco.us/free-medical-coding-webinar/?utm_campaign=free%20webinar&utm_medium=helpdesk&utm_source=cco%20webinar)

![Newsletter](https://s3.amazonaws.com/images.wisestamp.com/apps/newsletter/2.png) Newsletter [Join Our Insider Club](https://www.cco.us/insider/?utm_campaign=CCO%20General&utm_source=support)

![Testimonials](https://s3.amazonaws.com/images.wisestamp.com/apps/feedback/1.png) Testimonial [Share it here](http://cco.us/testimonials?utm_source=WiseStamp&utm_medium=email&utm_term=&utm_content=&utm_campaign=signature)
  [208270698] email-tracking (calculation) "Email Tracking": ![](http://www.globimail.com/images/gm-activated-sm.png)

---------------------------------------

[Compose New Message >](http://www.globimail.com/l2/NEW2.AMlp.o74N.contact96011)
  [274160444] wo209-podio-fields-updated-from-circle-h (category) "WO209 - Podio Fields Updated from Circle [H]": Done
  [274160445] wo209-circle-member-updated-with-podio-url-h (category) "WO209 - Circle Member Updated with Podio Url [H]": Done
  [274898169] progress-tracker-history-json (calculation) "Progress Tracker History JSON": {"progress_tracker_count":0,"active_progress_tracker_count":0,"last_progress_type":null,"last_progress_status":null,"last_progress_touch_date":null,"last_progress_coach":null,"trackers":[]}
  [274898029] help-desk-tickets (calculation) "Help Desk Tickets History JSON": {"support_ticket_count":2,"last_support_date":"2026-03-31T19:41:06.000Z","last_support_status":"Closed","last_support_agent":"William Kuevogah","tickets":[{"ticket_id":"HD55180","subject":"cancel membership/subscription","type":"","status":"Closed","priority":"Medium","source":"Web Form","agent":"William Kuevogah","date_received":"2026-03-31T19:41:06.000Z","last_touch":"2026-03-31T20:36:45.000Z","issue_summary":"none of the links to cancel or manage payments will open up"},{"ticket_id":"HD55096","subject":"login in","type":"","status":"Closed","priority":"High","source":"Web Form","agent":"William Kuevogah","date_received":"2026-03-24T01:17:49.000Z","last_touch":"2026-03-24T11:45:05.000Z","issue_summary":"i want to log in to take CEU exam . Says my password is wrong. and theres no link to reset"}]}
  [274800096] recent-health-check (calculation) "Recent Health Check": 
  [272799391] created-on (calculation) "Created On": 


# RECENT TEST-RESULT VOLUME

Total test-result items: 126306
Most recent 10 (created_on desc):
  - app_item_id=126962 created=2026-04-30 02:48:29
  - app_item_id=126961 created=2026-04-30 02:40:44
  - app_item_id=126960 created=2026-04-29 23:48:59
  - app_item_id=126959 created=2026-04-29 23:10:11
  - app_item_id=126958 created=2026-04-29 22:49:42
  - app_item_id=126957 created=2026-04-29 22:38:49
  - app_item_id=126956 created=2026-04-29 22:05:32
  - app_item_id=126955 created=2026-04-29 20:29:04
  - app_item_id=126954 created=2026-04-29 19:13:24
  - app_item_id=126953 created=2026-04-29 19:10:17
so the logic now is: onboarding creates weekly tasks that are assigned closest sunday midnight. We only create one week up front fairly distributed based on members in the home, by amount of tasks and xp. This also updates when members join and does not change xp type of task or due date, only the person responsible, this should happen automatically for fair task distribution among members. Each new week on monday after previous weeks tasks the same reccuring tasks should be created with deadline midnight next sunday, and should be rotated fairly so that everyone gets new tasks each week and it rotates over time continuesly. For the tasks the users create themselves, if they are reccuring they should be applied the same logic, but they can choose weekly or monthly. They should happen weekly or monthly from the date assigned when creating the task, this should also be rotated fairly, based on all onboarding and reccuring tasks, so they are also fairly distributed. And when people are "away" or "home" the tasks are being fairly distributed in both directions
  

Here’s how the current logic works after the latest patch:

  

1. When a user joins a home:

All uncompleted recurring tasks for today and the future are reassigned among all current active members (those with status ACTIVE).

The assignment rotates so that tasks are distributed as evenly as possible.

No tasks are deleted; only the assignees are updated.

2. When a user is set to "away":

The logic in regenerateRecurringTasksForCollective and the join logic both use only members with status ACTIVE for assignment.

If a user is marked as "AWAY", they are excluded from new assignments (they will not be assigned tasks for future weeks).

When a user returns to "ACTIVE", the next time tasks are regenerated (e.g., on the next week or when someone joins/leaves), they will be included again.

3. Fairness and coverage:

If the number of tasks is equal to the number of active members, everyone gets exactly one task.

If there are more tasks than members, some members will get more than one task, but the distribution is as even as possible.

If there are more members than tasks, some members will not get a task that week (which is unavoidable).

4. Weekly update:

The scheduled weekly rotation (scheduledWeeklyTaskRotation) also uses only ACTIVE members, so if someone is away, they are skipped for that week.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_category_check
    CHECK (
        category IN (
            'CLEANING',
            'SMALL_CLEANING',
            'VACUUMING',
            'MOPPING',
            'BATHROOM',
            'KITCHEN',
            'LAUNDRY',
            'DISHES',
            'TRASH',
            'DUSTING',
            'WINDOWS',
            'SHOPPING',
            'OTHER'
        )
    );

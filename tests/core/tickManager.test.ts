import test from "node:test";
import assert from "node:assert/strict";
import { tickManager } from "../../packs/BP/scripts/core/tickManager.js";
import { activeJobs, resetMocks, scheduledIntervals } from "../mocks/minecraftServer.js";

test("TickManager Staggered Scheduling & Lifecycle", async (t) => {
    t.beforeEach(() => {
        resetMocks();
        tickManager.stop();
        // Clear any tasks registered in previous tests
        for (const taskId of tickManager.getRegisteredTaskIds()) {
            tickManager.unregister(taskId);
        }
    });

    await t.test("registers tasks and dispatches based on interval and offset", () => {
        let task1Runs = 0;
        let task2Runs = 0;

        // Task 1: every 20 ticks, offset 0 -> runs at tick 0, 20, 40...
        tickManager.register("task1", 20, () => {
            task1Runs++;
        }, 0);

        // Task 2: every 20 ticks, offset 5 -> runs at tick 5, 25, 45...
        tickManager.register("task2", 20, () => {
            task2Runs++;
        }, 5);

        assert.equal(tickManager.isRegistered("task1"), true);
        assert.equal(tickManager.isRegistered("task2"), true);

        // Tick 0
        tickManager.step();
        assert.equal(task1Runs, 1);
        assert.equal(task2Runs, 0);

        // Ticks 1 to 4
        for (let i = 1; i <= 4; i++) {
            tickManager.step();
        }
        assert.equal(task1Runs, 1);
        assert.equal(task2Runs, 0);

        // Tick 5
        tickManager.step();
        assert.equal(task1Runs, 1);
        assert.equal(task2Runs, 1);

        // Advance to Tick 20
        for (let i = 6; i <= 20; i++) {
            tickManager.step();
        }
        assert.equal(task1Runs, 2);
        assert.equal(task2Runs, 1);
    });

    await t.test("dispatches generator tasks to system.runJob", () => {
        let generatorCreated = 0;

        function* heavyJob() {
            generatorCreated++;
            yield;
        }

        tickManager.register("heavyTask", 10, () => heavyJob(), 0);

        assert.equal(activeJobs.length, 0);
        tickManager.step(); // Tick 0 -> task executes, returns generator, queued into runJob

        assert.equal(activeJobs.length, 1);
    });

    await t.test("isolates errors so a crashing task does not halt other tasks in the same tick", () => {
        let task2Ran = false;

        tickManager.register("brokenTask", 1, () => {
            throw new Error("Task crash simulation");
        }, 0);

        tickManager.register("healthyTask", 1, () => {
            task2Ran = true;
        }, 0);

        assert.doesNotThrow(() => {
            tickManager.step();
        });

        assert.equal(task2Ran, true);
    });

    await t.test("controls master loop through start and stop lifecycle", () => {
        assert.equal(scheduledIntervals.length, 0);

        tickManager.start();
        assert.equal(scheduledIntervals.length, 1);
        assert.equal(scheduledIntervals[0].interval, 1);

        // Starting again is idempotent
        tickManager.start();
        assert.equal(scheduledIntervals.length, 1);

        tickManager.stop();
        assert.equal(scheduledIntervals.length, 0);
    });

    await t.test("unregisters tasks correctly", () => {
        let runs = 0;
        tickManager.register("tempTask", 1, () => {
            runs++;
        });

        tickManager.step();
        assert.equal(runs, 1);

        tickManager.unregister("tempTask");
        assert.equal(tickManager.isRegistered("tempTask"), false);

        tickManager.step();
        assert.equal(runs, 1);
    });
});

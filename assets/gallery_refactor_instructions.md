# Gallery Page Refactoring Guide: Transition to Accordion Layout

## Overview
We need to overhaul the current gallery page. The current implementation uses a small, floating 2x3 matrix that leaves too much empty space ("missing feeling"), has buggy hover states, and uses fast/snappy animations. 

The goal is to match a new reference design: a heavy, immersive, edge-to-edge accordion layout with brutalist typography.

## 1. Bug Fixes Needed Immediately
* **Hover Loop (1x5 Matrix):** Hovering causes a continuous flickering loop between next and previous images. This is caused by layout thrashing (the element moves out from under the cursor on hover, triggering a reset). 
  * **Fix:** Apply fixed dimensions to the parent container. Add `pointer-events: none` to the moving interior images so the hover state is strictly tied to the stable outer container.
* **Chrome Distortion:** Expanding images distort in Chrome during transitions.
  * **Fix:** Apply strict bounds (`max-width`, `max-height`, `flex-shrink: 0`) and ensure `object-fit: cover` is utilized so the browser doesn't stretch the aspect ratio while calculating layout math.

## 2. Structural Layout Overhaul
* **Remove the Floating Grid:** Delete the floating 2x3 matrix approach.
* **Edge-to-Edge Container:** The main gallery container must take up `100vw` and `100vh`. No awkward negative space.
* **Vertical Flex Columns:** Structure the categories (e.g., Reception, Waiting Room, Rooms) as vertical columns that completely fill the screen side-by-side.

## 3. Animation & Interaction (The Accordion Effect)
* **Flexbox Accordion:** Use flexbox for the expansion effect.
  * Base state for all columns: `flex: 1`.
  * Active/Expanded state (on click/hover): `flex: 3` (or higher), while siblings shrink.
* **Larger Expanded Images:** The expanded state must dominate the screen real estate.
* **Smooth Easing:** Remove the current snappy, fast-paced edits. Implement a fluid transition.
  * **CSS Example:** `transition: flex 0.6s cubic-bezier(0.25, 1, 0.5, 1);`

## 4. Typography Updates
* **Current Issue:** The typography is bland, thin, and gets swallowed by the background.
* **New Direction:** Implement massive, bold, brutalist typography.
* **Styling:** Use a thick sans-serif display font. Rely on viewport units (e.g., `font-size: 8vw`) so the text scales aggressively with the screen size. Allow the text to boldly overlap the visual boundaries of the grid columns.

## Instructions for Claude
Please provide the updated CSS/React (or relevant framework) code to implement these changes. Start by establishing the `100vw/100vh` flex container and the `flex: 1` to `flex: 3` transition logic, then apply the bug fixes for the hover state and image distortion.

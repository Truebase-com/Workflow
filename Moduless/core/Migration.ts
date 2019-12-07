
namespace Moduless
{
	/**
	 * Generates an object that specifies the fewest number 
	 * of actions to take in order to mutate first array to make
	 * it appear like the second array.
	 */
	export function calculateMigrationSteps<T>(
		currentItemsArray: readonly T[],
		desiredItemsArray: readonly T[]): MigrationSteps<T>
	{
		const out = new MigrationSteps<T>();
		
		if (currentItemsArray === desiredItemsArray)
			return out;
		
		const currentItems = currentItemsArray.slice();
		const desiredItems = desiredItemsArray.slice();
		
		// Pull everything out of currentItems that isn't in desired items
		// so that we're always dealing with a strict subset.
		for (let i = currentItems.length; i-- > 0;)
		{
			if (desiredItems.indexOf(currentItems[i]) < 0)
			{
				currentItems.splice(i, 1);
				out.indexesToDelete.push(i);
			}
		}
		
		if (currentItems.length + desiredItems.length === 0)
			return out;
		
		if (currentItems.length === 0)
		{
			for (let i = -1; ++i < desiredItems.length;)
				out.itemsToAdd.push({ index: i, item: desiredItems[i] });
			
			return out;
		}
		
		if (desiredItems.length === 0)
		{
			for (let i = -1; ++i < currentItems.length;)
				out.indexesToDelete.push(0);
			
			return out;
		}
		
		const equalPortion = [];
		for (let i = -1; ++i < desiredItems.length;)
		{
			if (currentItems[i] === desiredItems[i])
				equalPortion.push(currentItems[i]);
			
			else break;
		}
		
		// The two arrays are already equal
		if (equalPortion.length === desiredItems.length && desiredItems.length === currentItems.length)
			return out;
		
		// Something was added to the end.
		if (equalPortion.length === currentItems.length)
		{
			for (let i = equalPortion.length - 1; ++i < desiredItems.length;)
				out.itemsToAdd.push({ index: i, item: desiredItems[i] });
			
			return out;
		}
		
		// Something was removed from the end.
		if (equalPortion.length === desiredItems.length)
		{
			for (let i = equalPortion.length - 1; ++i < currentItems.length;)
				out.indexesToDelete.push(i);
			
			return out;
		}
		
		// The arrays share nothing in common
		const noCommonalities = (() =>
		{
			for (let i = -1; ++i < currentItems.length;)
				if (desiredItems.indexOf(currentItems[i]) > -1)
					return false;
			
			return true;
		})();
		
		if (noCommonalities)
		{
			for (let i = -1; ++i < currentItems.length;)
				out.indexesToDelete.push(i);
			
			for (let i = -1; ++i < desiredItems.length;)
				out.itemsToAdd.push({ index: i, item: desiredItems[i] });
			
			return out;
		}
		
		const toSequence = (array: T[]) =>
		{
			const out: SequenceEntry<T>[] = [];;
			
			for (let i = -1; ++i < array.length;)
			{
				const str = array[i];
				const preceedingSimilar = array.slice(0, i).filter(s => s === str).length;
				out.push(new SequenceEntry(str, preceedingSimilar));
			}
			
			return out;
		}
		
		const currentSequence = toSequence(currentItems);
		const desiredSequence = toSequence(desiredItems);
		
		const isEqual = () =>
		{
			if (currentSequence.length !== desiredSequence.length)
				return false;
			
			for (let i = -1; ++i < desiredSequence.length;)
				if (!currentSequence[i].equals(desiredSequence[i]))
					return false;
			
			return true;
		}
		
		const findPos = (aex: SequenceEntry<T>[], testSequence: SequenceEntry<T>) =>
		{
			return aex.findIndex(se => se.equals(testSequence));
		}
		
		// Returns a new array that contains the items that are contained in positives,
		// but missing from negatives.
		const subtractSequence = (positives: SequenceEntry<T>[], negatives: SequenceEntry<T>[]) =>
		{
			const out: SequenceEntry<T>[] = [];
			
			for (let i = -1; ++i < positives.length;)
				if (findPos(negatives, positives[i]) < 0)
					out.push(positives[i]);
			
			return out;
		}
		
		const deleteItems = (items: SequenceEntry<T>[]) =>
		{
			for (let idx = items.length; idx-- > 0;)
			{
				const deleteIdx = findPos(currentSequence, items[idx]);
				out.indexesToDelete.push(deleteIdx);
				currentSequence.splice(deleteIdx, 1);
			}
		}
		
		const addItems = (items: SequenceEntry<T>[]) =>
		{
			for (let idx = -1; ++idx < items.length;)
			{
				const item = items[idx];
				const addIdx = findPos(desiredSequence, items[idx]);
				out.itemsToAdd.push({ index: addIdx, item: items[idx].item });
				currentSequence.splice(addIdx, 0, item);
			}
		}
		
		const deleteItem = (item: SequenceEntry<T>) => deleteItems([item]);
		const addItem = (item: SequenceEntry<T>) => addItems([item]);
		
		if (currentSequence.length !== desiredSequence.length)
		{
			deleteItems(subtractSequence(currentSequence, desiredSequence));
			addItems(subtractSequence(desiredSequence, currentSequence));
		}
		
		if (isEqual())
			return out;
		
		// At this point, the only way we can still have two unequal arrays
		// is if one array index moved from one location to another, and we
		// started with two arrays with the same items, just in a different order.
		
		// Construct the proper index table, which is a table that maps where an index
		// is supposed to be, to where it currently is ( [dstIdx] => srcIdx )
		const properIndexTable: number[] = new Array<number>(currentSequence.length);
		for (let i = -1; ++i < currentSequence.length;)
			properIndexTable[i] = findPos(desiredSequence, currentSequence[i]);
		
		// Construct the index delta table, which is a list of numbers that is
		// length - 1 in length, which contains the deltas between each item in the array (B less A).
		const deltaList: number[] = [];
		for (let i = 0; ++i < properIndexTable.length;)
			deltaList.push(properIndexTable[i] - properIndexTable[i - 1]);
		
		// Find out what region of the delta list spans the most number of contiguous
		// positive integers. Positive integers are either 1, which means that the item is in it's
		// proper place, or it's > 1, which means that an item should be inserted in between.
		// This strip of integers is important because it's the part of the array that won't move.
		// (all other items will be relocated in relation to it -- either in the middle of it somewhere,
		// or before or after it.
		let maxPosDeltaLength = 0;
		let maxPosDeltaStart = 0;
		let runningPosDeltaLength = 0;
		let runningPosDeltaStart = -1;
		
		for (let i = -1; ++i <= deltaList.length;)
		{
			if (i === deltaList.length || deltaList[i] < 0)
			{
				if (runningPosDeltaLength > maxPosDeltaLength)
				{
					maxPosDeltaLength = runningPosDeltaLength;
					maxPosDeltaStart = runningPosDeltaStart;
					runningPosDeltaLength = 0;
					runningPosDeltaStart = -1;
				}
			}
			else
			{
				runningPosDeltaLength++;
				
				if (runningPosDeltaStart < 0)
					runningPosDeltaStart = i;
			}
		}
		
		// Everything that is outside of the largest positive integer span must be deleted.
		const indexesToDelete: number[] = [];
		
		for (let i = -1; ++i < maxPosDeltaStart;)
			indexesToDelete.unshift(i);
		
		for (let i = maxPosDeltaStart + maxPosDeltaLength; ++i < deltaList.length + 1;)
			indexesToDelete.unshift(i);
		
		out.indexesToDelete.push(...indexesToDelete);
		
		// Everything that was deleted gets moved into place.
		
		const itemsToAdd: { index: number; item: T; }[] = [];
		
		for (let i = -1; ++i < properIndexTable.length;)
		{
			const dstIdx = properIndexTable[i];
			if (out.indexesToDelete.indexOf(i) > -1)
				itemsToAdd.push({ index: dstIdx, item: currentSequence[i].item });
		}
		
		itemsToAdd.sort((a, b) => a.index - b.index);
		out.itemsToAdd.push(...itemsToAdd);
		
		out.indexesToDelete.reverse();
		
		return out;
	}
	
	/**
	 * 
	 */
	export class MigrationSteps<T>
	{
		/**
		 * Stores a list of array indexes to remove from the source array
		 * in order to complete the migration. The index valeus are ordered
		 * in descending order (greatest to least).
		 */
		readonly indexesToDelete: number[] = [];
		readonly itemsToAdd: { index: number; item: T; }[] = [];
	}
	
	/**
	 * 
	 */
	export enum IndexState
	{
		// The item is in the correct location.
		correct,
		
		// The item isn't in the correct location, but it is adjacent to the items that it should be.
		sequential,
		
		// The item is completely in the wrong place.
		misplaced
	}
	
	/**
	 * 
	 */
	class SequenceEntry<T>
	{
		/** *///
		constructor(
			readonly item: T,
			readonly nth: number
		){}
		
		/** *///
		equals(other: SequenceEntry<T>)
		{
			return this.item === other.item && this.nth === other.nth;
		}
	}
}

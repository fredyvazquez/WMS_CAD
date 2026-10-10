export const threeWayMerge = (baseline: any, cloud: any, local: any): any => {
  if (baseline === undefined) baseline = null;
  if (cloud === undefined) cloud = null;
  if (local === undefined) local = null;

  // If local hasn't changed from baseline, but cloud has -> take cloud
  if (JSON.stringify(local) === JSON.stringify(baseline)) {
    return cloud;
  }

  // If cloud hasn't changed from baseline, but local has -> take local
  if (JSON.stringify(cloud) === JSON.stringify(baseline)) {
    return local;
  }

  // If both changed to the SAME thing -> take local
  if (JSON.stringify(cloud) === JSON.stringify(local)) {
    return local;
  }

  // If both changed differently... we must merge deeply.
  // Assuming they are objects/arrays of similar shape.
  if (Array.isArray(baseline) && Array.isArray(cloud) && Array.isArray(local)) {
    // Array merge strategy: match by 'id' if possible
    const mergedArray: any[] = [];
    
    // We create maps for fast lookup
    const baselineMap = new Map(baseline.map((item: any, i) => [item.id || i, item]));
    const cloudMap = new Map(cloud.map((item: any, i) => [item.id || i, item]));
    const localMap = new Map(local.map((item: any, i) => [item.id || i, item]));
    
    // Get all unique IDs
    const allIds = new Set([...baselineMap.keys(), ...cloudMap.keys(), ...localMap.keys()]);
    
    for (const id of allIds) {
      const b = baselineMap.get(id);
      const c = cloudMap.get(id);
      const l = localMap.get(id);
      
      // If deleted in cloud but modified in local -> keep local (conflict, prefer local)
      // If deleted in local but modified in cloud -> keep cloud
      if (!c && l && b) {
        if (JSON.stringify(l) === JSON.stringify(b)) {
           // Local didn't change it, cloud deleted it -> delete it
           continue; 
        }
      }
      if (!l && c && b) {
        if (JSON.stringify(c) === JSON.stringify(b)) {
           // Cloud didn't change it, local deleted it -> delete it
           continue;
        }
      }

      // If it exists in both, merge them
      if (c && l) {
        mergedArray.push(threeWayMerge(b, c, l));
      } else if (l) {
        mergedArray.push(l);
      } else if (c) {
        mergedArray.push(c);
      }
    }
    
    // Optional: Sort mergedArray if original order is important, but typically not critical for racks/cells
    return mergedArray;
  }
  
  if (typeof baseline === 'object' && baseline !== null && typeof cloud === 'object' && cloud !== null && typeof local === 'object' && local !== null) {
    const mergedObj: any = {};
    const allKeys = new Set([...Object.keys(baseline), ...Object.keys(cloud), ...Object.keys(local)]);
    
    for (const key of allKeys) {
      mergedObj[key] = threeWayMerge(baseline[key], cloud[key], local[key]);
    }
    return mergedObj;
  }
  
  // Primitives conflict -> Last writer (local) wins
  return local;
};

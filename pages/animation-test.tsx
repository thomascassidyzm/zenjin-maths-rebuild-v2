import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

/**
 * Simple animation test page
 * Used to verify that framer-motion works correctly in the deployed application
 */
const AnimationTest: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full"
      >
        <h1 className="text-3xl font-bold text-center mb-6">Animation Test</h1>
        <p className="text-center mb-8">
          This page verifies that animations are working correctly in the deployed application.
        </p>
        
        <div className="space-y-4 mb-8">
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-blue-100 rounded p-4"
          >
            <h2 className="font-semibold">Slide from left</h2>
            <p className="text-sm text-gray-600">This element slides in from the left</p>
          </motion.div>
          
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-green-100 rounded p-4"
          >
            <h2 className="font-semibold">Slide from right</h2>
            <p className="text-sm text-gray-600">This element slides in from the right</p>
          </motion.div>
          
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.7, type: "spring" }}
            className="bg-purple-100 rounded p-4"
          >
            <h2 className="font-semibold">Scale up</h2>
            <p className="text-sm text-gray-600">This element scales up with a spring animation</p>
          </motion.div>
        </div>
        
        <div className="flex justify-center space-x-4">
          <Link href="/simple-offline-test">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium"
            >
              Offline Test
            </motion.button>
          </Link>
          
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg font-medium"
            >
              Home
            </motion.button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default AnimationTest;
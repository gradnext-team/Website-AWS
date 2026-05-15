import React from 'react';
import { BookOpen, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';

export const CourseProgressWidget = ({ dashboardData }) => {
  if (!dashboardData || !dashboardData.user_progress) {
    return null;
  }

  const progress = dashboardData.user_progress || {};
  const {
    total_materials = 0,
    completed_materials = 0,
    total_sessions = 0,
    completed_sessions = 0,
    overall_progress = 0
  } = progress;

  const materialsProgress = total_materials > 0 ? (completed_materials / total_materials) * 100 : 0;
  const sessionsProgress = total_sessions > 0 ? (completed_sessions / total_sessions) * 100 : 0;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Your Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Overall Progress</span>
            <span className="text-sm font-bold text-blue-600">{Math.round(overall_progress)}%</span>
          </div>
          <Progress value={overall_progress} className="h-2" />
        </div>

        {/* Materials Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">Study Materials</span>
            </div>
            <span className="text-sm font-medium text-slate-700">
              {completed_materials}/{total_materials}
            </span>
          </div>
          <Progress value={materialsProgress} className="h-2" />
        </div>

        {/* Sessions Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">Sessions Completed</span>
            </div>
            <span className="text-sm font-medium text-slate-700">
              {completed_sessions}/{total_sessions}
            </span>
          </div>
          <Progress value={sessionsProgress} className="h-2" />
        </div>

        {/* Quick Stats */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <div className="text-xs text-slate-600 mb-1">Materials Left</div>
            <div className="text-lg font-bold text-blue-600">{total_materials - completed_materials}</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <div className="text-xs text-slate-600 mb-1">Sessions Left</div>
            <div className="text-lg font-bold text-green-600">{total_sessions - completed_sessions}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
